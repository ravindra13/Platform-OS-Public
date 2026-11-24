# api/ai/tools/schemas_view.py

BASE_VIEW_CONFIGS = {
    "list": {
        "properties": {
            "columns": { "type": "array", "items": { "type": "string" }, "description": "Fields to display in the data grid" }
        },
        "required": ["columns"]
    },
    "spreadsheet": {
        "properties": {
            "columns": { "type": "array", "items": { "type": "string" }, "description": "Fields to display in the grid" },
            "editableFields": { "type": "array", "items": { "type": "string" }, "description": "Subset of columns that can be inline-edited" }
        },
        "required": ["columns"]
    },
    
    "kanban": {
        "properties": {
            "groupByField": { "type": "string", "description": "The picklist field used to create columns" },
            "cardFields": { "type": "array", "items": { "type": "string" }, "description": "Fields to display on each kanban card" },
            "allowDragAndDrop": { "type": "boolean" }
        },
        "required": ["groupByField"]
    },
    "detail": {
        "properties": {
            "layoutType": { "type": "string", "description": "MANDATORY. The structural layout of the page. Typically 'CommandCenter'." },
            "mainArea": { "type": "array", "items": { "type": "string" }, "description": "MANDATORY. List of primary field names to display in the main body." },
            "side_panel": { "type": "array", "items": { "type": "string" }, "description": "Optional. List of secondary field names to display on the side." },
            "pathWidget": { 
                "type": "object",
                "properties": { "field": { "type": "string" } },
                "required": ["field"]
            },
            "relatedLists": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "tabLabel": { "type": "string" },
                        "childObject": { "type": "string" },
                        "relationshipField": { "type": "string" },
                        "columns": { "type": "array", "items": { "type": "string" } }
                    },
                    "required": ["tabLabel", "childObject", "relationshipField", "columns"]
                }
            }
        },
        "required": ["layoutType", "mainArea"]
    },
    "calendar": {
        "type": "object",
        "properties": {
            "titleField": { "type": "string" },
            "startDateField": { "type": "string" },
            "endDateField": { "type": "string" }
        },
        "required": ["titleField", "startDateField"]
    },
    "gantt": {
        "type": "object",
        "properties": {
            "titleField": { "type": "string" },
            "startDateField": { "type": "string" },
            "endDateField": { "type": "string" },
            "progressField": { "type": "string" }
        },
        "required": ["titleField", "startDateField", "endDateField"]
    },
    "hierarchy": {
        "type": "object",
        "properties": {
            "parentReferenceField": { "type": "string", "description": "Mandatory. The reference or lookup field that links a record to its parent ID" },
            "primaryLabelField": { "type": "string", "description": "Mandatory. The text field to display as the main label for each node in the tree" },
            "statusColorField": { "type": "string", "description": "Optional field used to toggle the status indicator color on the node" }
        },
        "required": ["parentReferenceField", "primaryLabelField"]
    },
    "spatial": {
        "type": "object",
        "properties": {
            "x_axis_field": { "type": "string" },
            "y_axis_field": { "type": "string" },
            "status_color_field": { "type": "string" },
            "background_image_url": { "type": "string" },
            "cardFields": { "type": "array", "items": { "type": "string" } }
        },
        "required": ["x_axis_field", "y_axis_field"]
    },
    "inventory": {
        "type": "object",
        "properties": {
            "titleField": { "type": "string", "description": "Field for the item name" },
            "quantityField": { "type": "string", "description": "Numeric field for current stock" },
            "thresholdField": { "type": "string", "description": "Numeric field for low-stock warning" },
            "skuField": { "type": "string", "description": "Optional field for SKU or item code" }
        },
        "required": ["titleField", "quantityField", "thresholdField"]
    },
    "inbox": {
        "type": "object",
        "properties": {
            "childDataSource": { "type": "string", "description": "The related object for the threads (e.g., EmailMessage)" },
            "threadMapping": { "type": "object" }
        },
        "required": ["childDataSource"]
    },
    "split_pane": {
        "type": "object",
        "properties": {
            "documentField": { "type": "string", "description": "Field containing the file URL or attachment ID" },
            "formFields": { "type": "array", "items": { "type": "string" }, "description": "Fields to expose on the right side for data entry" }
        },
        "required": ["documentField", "formFields"]
    },

    "catalogue": {
        "type": "object",
        "properties": {
            "productMapping": { 
                "type": "object",
                "properties": {
                    "titleField": { "type": "string" },
                    "priceField": { "type": "string" },
                    "imageField": { "type": "string" }
                },
                "description": "Maps product fields for the catalogue cards"
            },
            "checkoutConfig": {
                "type": "object",
                "properties": {
                    "orderObject": { "type": "string", "description": "Target table for the Order Header" },
                    "lineItemObject": { "type": "string", "description": "Target table for the Line Items" },
                    "orderRelationshipField": { "type": "string", "description": "Lookup field on Line Item pointing to Order" },
                    "productRelationshipField": { "type": "string", "description": "Lookup field on Line Item pointing to Product" },
                    "quantityField": { "type": "string" },
                    "unitPriceField": { "type": "string" },
                    "totalAmountField": { "type": "string" },
                    "statusField": { "type": "string" },
                    "draftStatusValue": { "type": "string" },
                    "completedStatusValue": { "type": "string" }
                }
            }
        },
        "required": ["productMapping", "checkoutConfig"]
    },

    "gallery": {
        "properties": {
            "columns": { "type": "array", "items": { "type": "string" }, "description": "Fields to display on the card" },
            "imageField": { "type": "string", "description": "Optional. The field containing the image URL" }
        },
        "required": ["columns"]
    },



}

MODULE_VIEW_MAPPINGS_SCHEMA = {
    "type": "object",
    "description": "Defines the frontend view configuration grouped by view_type.",
    "properties": {
        "list": { "type": "object", **BASE_VIEW_CONFIGS["list"] },
        "spreadsheet": { "type": "object", **BASE_VIEW_CONFIGS["spreadsheet"] },
        "kanban": { "type": "object", **BASE_VIEW_CONFIGS["kanban"] },
        "detail": { "type": "object", **BASE_VIEW_CONFIGS["detail"] },
        "calendar": { "type": "object", **BASE_VIEW_CONFIGS["calendar"] },
        "gantt": { "type": "object", **BASE_VIEW_CONFIGS["gantt"] },
        "hierarchy": { "type": "object", **BASE_VIEW_CONFIGS["hierarchy"] },
        "spatial": { "type": "object", **BASE_VIEW_CONFIGS["spatial"] },
        "inventory": { "type": "object", **BASE_VIEW_CONFIGS["inventory"] },
        "inbox": { "type": "object", **BASE_VIEW_CONFIGS["inbox"] },
        "split_pane": { "type": "object", **BASE_VIEW_CONFIGS["split_pane"] },
        "catalogue": { "type": "object", **BASE_VIEW_CONFIGS["catalogue"] },
        "gallery": { "type": "object", **BASE_VIEW_CONFIGS["gallery"] }
    }
}

SINGLE_VIEW_CONFIG_SCHEMA = {
    "type": "object",
    "description": "The exact configuration properties for the specific view_type being updated. Output the properties directly as a flat object.",
    "anyOf": [
        {"type": "object", "title": "List Config", **BASE_VIEW_CONFIGS["list"]},
        {"type": "object", "title": "Spreadsheet Config", **BASE_VIEW_CONFIGS["spreadsheet"]},
        {"type": "object", "title": "Kanban Config", **BASE_VIEW_CONFIGS["kanban"]},
        {"type": "object", "title": "Detail Config", **BASE_VIEW_CONFIGS["detail"]},
        {"type": "object", "title": "Calendar Config", **BASE_VIEW_CONFIGS["calendar"]},
        {"type": "object", "title": "Gantt Config", **BASE_VIEW_CONFIGS["gantt"]},
        {"type": "object", "title": "Hierarchy Config", **BASE_VIEW_CONFIGS["hierarchy"]},
        {"type": "object", "title": "Spatial Config", **BASE_VIEW_CONFIGS["spatial"]},
        {"type": "object", "title": "Inventory Config", **BASE_VIEW_CONFIGS["inventory"]},
        {"type": "object", "title": "Inbox Config", **BASE_VIEW_CONFIGS["inbox"]},
        {"type": "object", "title": "Split Pane Config", **BASE_VIEW_CONFIGS["split_pane"]},
        {"type": "object", "title": "Catalogue Config", **BASE_VIEW_CONFIGS["catalogue"]},
        {"type": "object", "title": "Gallery Config", **BASE_VIEW_CONFIGS["gallery"]}
    ]
}