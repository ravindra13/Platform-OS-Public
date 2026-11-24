// js/components/CalendarView.js
import { fetchQuery, executeAction } from '../services/api.js';
import { renderError } from '../utils/ui.js';

export const CalendarView = (schema) => {
    const wrapper = document.createElement('div');
    wrapper.className = "w-full bg-white border border-slate-200 rounded-xl shadow-sm p-6 relative h-[800px]";

    const calendarContainer = document.createElement('div');
    calendarContainer.className = "h-full w-full custom-calendar-theme";
    wrapper.appendChild(calendarContainer);

    // Inject custom CSS to make FullCalendar match your Tailwind theme
    // Added a check so it doesn't append multiple times if the user switches views back and forth
    if (!document.getElementById('fullcalendar-custom-style')) {
        const style = document.createElement('style');
        style.id = 'fullcalendar-custom-style';
        style.innerHTML = `
            .fc-theme-standard .fc-scrollgrid { border-color: #e2e8f0; }
            .fc-theme-standard td, .fc-theme-standard th { border-color: #e2e8f0; }
            .fc-col-header-cell-cushion { color: #475569; font-weight: 600; padding: 12px 0 !important; }
            .fc-daygrid-day-number { color: #64748b; font-weight: 500; font-size: 14px; padding: 8px !important; }
            .fc-event { border-radius: 6px; padding: 2px 4px; border: none; font-size: 12px; font-weight: 600; cursor: pointer; }
            .fc-h-event { background-color: #e0e7ff; color: #4f46e5; border-left: 3px solid #4f46e5; }
            .fc .fc-button-primary { background-color: #fff; color: #475569; border-color: #cbd5e1; text-transform: capitalize; font-weight: 600; }
            .fc .fc-button-primary:not(:disabled):active, .fc .fc-button-primary:not(:disabled).fc-button-active { background-color: #f1f5f9; color: #0f172a; border-color: #94a3b8; }
            .fc .fc-toolbar-title { font-size: 1.25rem; font-weight: 700; color: #1e293b; }
        `;
        document.head.appendChild(style);
    }
    setTimeout(() => {
        if (typeof FullCalendar === 'undefined') {
            renderError(wrapper, "FullCalendar library failed to load. Check index.html scripts.");
            return;
        }

        const calendar = new FullCalendar.Calendar(calendarContainer, {
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            editable: true, // Enables drag and drop
            selectable: true, // Enables clicking empty days to create records
            eventDisplay: 'block',

            // 1. Fetch records from Backend and map them to Events
            events: async function(info, successCallback, failureCallback) {
                try {
                    const fields = ["Id", schema.calendarMapping.titleField, schema.calendarMapping.startDateField, schema.calendarMapping.endDateField];
                    const filters = [
                        { field: schema.calendarMapping.startDateField, operator: ">", value: info.startStr.split('T')[0] },
                        { field: schema.calendarMapping.startDateField, operator: "<", value: info.endStr.split('T')[0] }
                    ];

                    // Centralized API call
                    const records = await fetchQuery(schema.dataSource, fields, filters);
                    const mappedEvents = records.map(row => {
                        let titleVal = row[schema.calendarMapping.titleField];
                        if (titleVal && typeof titleVal === 'object') titleVal = titleVal.Name || titleVal.Id;

                        return {
                            id: row.Id,
                            title: titleVal || `Record ${row.Id}`,
                            start: row[schema.calendarMapping.startDateField],
                            end: row[schema.calendarMapping.endDateField]
                        };
                    });

                    successCallback(mappedEvents);
                } catch (error) {
                    failureCallback(error);
                }
            },

            // 2. Intercept Drag-and-Drop to update Backend
            eventDrop: async function(info) {
                const recordId = info.event.id;
                // Format JS dates to YYYY-MM-DD for backend
                const newStart = info.event.start.toISOString().split('T')[0];
                const newEnd = info.event.end ? info.event.end.toISOString().split('T')[0] : null;

                const updatePayload = {
                    "Id": recordId,
                    [schema.calendarMapping.startDateField]: newStart
                };

                if (schema.calendarMapping.endDateField && schema.calendarMapping.endDateField !== schema.calendarMapping.startDateField && newEnd) {
                    updatePayload[schema.calendarMapping.endDateField] = newEnd;
                }

                try {
                    // Centralized Action pipeline execution
                    await executeAction(schema.dataSource, [updatePayload]);
                } catch (error) {
                    alert(`Could not reschedule: ${error.message}`);
                    info.revert(); // Snap the visual event back to original date
                }
            },

            // 3. Double-click event to open Entity 360 Detail View
            eventClick: function(info) {
                if (typeof openRecordDetail === 'function') {
                    openRecordDetail(schema.dataSource, info.event.id);
                }
            },

            // 4. Click empty day to create a new record
            dateClick: function(info) {
                if (typeof openRecordDetail === 'function') {
                    openRecordDetail(schema.dataSource, 'NEW');
                }
            }
        });

        calendar.render();
    }, 100);

    return wrapper;
};
