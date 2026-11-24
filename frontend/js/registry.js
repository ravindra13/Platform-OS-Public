// js/registry.js
import { CardGrid } from './components/CardGrid.js';
import { KanbanBoard } from './components/KanbanBoard.js';
// import { WorkQueue } from './components/WorkQueue.js';
import { CalendarView } from './components/CalendarView.js';
import { ActivityStream } from './components/ActivityStream.js';
import { DataGrid } from './components/DataGrid.js';
import { InventoryBoard } from './components/InventoryBoard.js';
import { PageLayout } from './components/PageLayout.js';
import { Tabs } from './components/Tabs.js';
import { Container } from './components/Container.js';
import { GoogleCard } from './components/GoogleCard.js';
import { Grid } from './components/Grid.js';
import { Header } from './components/Header.js';
import { KPI_Card } from './components/KPI_Card.js';
import { QuickActions } from './components/QuickActions.js';
import { SystemLog } from './components/SystemLog.js';
import { Form } from './components/Form.js';
// import { TimeSeriesChart } from './components/TimeSeriesChart.js';
import { PathWidget } from './components/PathWidget.js';
import { SpatialBoard } from './components/SpatialBoard.js';
import { InboxView } from './components/InboxView.js';
import { Record360 } from './components/Record360.js';
// import { ActivityFeedWidget } from './components/ActivityFeedWidget.js';
import { RelatedList } from './components/RelatedList.js';
import { HierarchyView } from './components/HierarchyView.js';
import { GanttView } from './components/GanttView.js';
import { SpreadsheetView } from './components/SpreadsheetView.js';
import { DocumentSplitPaneView } from './components/DocumentSplitPaneView.js';
import { CatalogueBoard } from './components/CatalogueBoard.js';
import { GalleryView } from './components/GalleryView.js';
import { ObjectCard } from './components/ObjectCard.js';
import { ThreadChatWidget, FileAttachmentWidget, AuditHistoryWidget } from './components/CapabilityWidgets.js';


export const LayoutRegistry = {
    "CardGrid": CardGrid,
    "KanbanBoard": KanbanBoard,
    // "WorkQueue": WorkQueue,
    "CalendarView": CalendarView,
    "ActivityStream": ActivityStream,
    "DataGrid": DataGrid,
    "InventoryBoard": InventoryBoard,
    "PageLayout": PageLayout,
    "Tabs": Tabs,
    "Container": Container,
    "GoogleCard": GoogleCard,
    "Grid": Grid,
    "Header": Header,
    "KPI_Card": KPI_Card,
    "QuickActions": QuickActions,
    "SystemLog": SystemLog,
    "Form": Form,
    // "TimeSeriesChart": TimeSeriesChart,
    "PathWidget": PathWidget,
    "SpatialBoard": SpatialBoard,
    "InboxView": InboxView,
    "Record360": Record360,
    "HierarchyView": HierarchyView,
    // "ActivityFeedWidget": ActivityFeedWidget,
    "RelatedList": RelatedList,
    "ThreadChatWidget": ThreadChatWidget,
    "FileAttachmentWidget": FileAttachmentWidget,
    "AuditHistoryWidget": AuditHistoryWidget,
    "GanttView": GanttView,
    "SpreadsheetView": SpreadsheetView,
    "DocumentSplitPaneView": DocumentSplitPaneView,
    "CatalogueBoard": CatalogueBoard,
    "GalleryView": GalleryView,
    "ObjectCard": ObjectCard
};

// export const renderComponent = (schema) => {
//     const builder = LayoutRegistry[schema.type];
//     if (!builder) {
//         const errorDiv = document.createElement('div');
//         errorDiv.innerText = `Unknown component: ${schema.type}`;
//         return errorDiv;
//     }
//     return builder(schema);
// };

export const renderComponent = (schema) => {
    const builder = LayoutRegistry[schema.type];
    if (!builder) {
        const errorDiv = document.createElement('div');
        errorDiv.innerText = `Unknown component: ${schema.type}`;
        return errorDiv;
    }
    return builder(schema, renderComponent); // <-- ADD renderComponent HERE
};