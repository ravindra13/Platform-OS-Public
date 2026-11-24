// js/components/InboxView.js
import { fetchQuery, executeAction } from '../services/api.js';
import { renderLoading, renderError } from '../utils/ui.js';

export const InboxView = (schema) => {
    // 1. Main Layout Container
    const mainContainer = document.createElement('div');
    mainContainer.className = "flex h-[700px] w-full gap-4 bg-transparent";

    // 2. Left Sidebar (Threads)
    const sidebar = document.createElement('div');
    sidebar.className = "w-1/3 flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden";

    const sidebarHeader = document.createElement('div');
    sidebarHeader.className = "p-4 border-b border-slate-200 bg-slate-50 font-bold text-slate-700 tracking-tight flex justify-between items-center";
    sidebarHeader.innerHTML = `<span>Active Conversations</span><span class="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full" id="thread-count">0</span>`;
    sidebar.appendChild(sidebarHeader);

    const threadList = document.createElement('div');
    threadList.className = "flex-1 overflow-y-auto custom-scrollbar flex flex-col";
    sidebar.appendChild(threadList);

    // 3. Right Panel (Chat Area)
    const chatPanel = document.createElement('div');
    chatPanel.className = "flex-1 flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden relative";

    let activeThreadId = null;
    const childDataSource = schema.childDataSource || "ThreadMessage";

    // --- Data Fetching ---
    const loadThreads = async () => {
        renderLoading(threadList, "Loading threads...");
        try {
            // Fetch parent MessageThread records
            const threads = await fetchQuery(
                schema.dataSource,
                ['Id', 'PatientId', 'Subject', 'Status', 'CreatedDate'],
                schema.filters || []
            );

            threadList.innerHTML = "";
            document.getElementById('thread-count').innerText = threads.length;

            if (threads.length === 0) {
                threadList.innerHTML = `<div class="p-6 text-center text-sm text-slate-400">No active conversations found.</div>`;
                return;
            }

            threads.forEach(thread => {
                const item = document.createElement('div');
                item.className = "p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors group";
                item.id = `thread-item-${thread.Id}`;

                // Display Patient ID as subtitle, Subject as main title
                const displayTitle = thread.Subject || 'No Subject';
                const displaySub = (thread.PatientId && typeof thread.PatientId === 'object') ? thread.PatientId.Name : (thread.PatientId || 'Unknown Patient');

                item.innerHTML = `
                    <div class="flex justify-between items-start mb-1">
                        <span class="font-semibold text-slate-800 text-sm truncate pr-2">${displayTitle}</span>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-500 uppercase">${thread.Status}</span>
                    </div>
                    <div class="text-xs text-slate-500 truncate">Patient: ${displaySub}</div>
                `;

                item.addEventListener('click', () => selectThread(thread, item));
                threadList.appendChild(item);
            });

        } catch (error) {
            renderError(threadList, "Failed to load threads.");
        }
    };

    const selectThread = (thread, element) => {
        // Update UI selection state
        threadList.querySelectorAll('div[id^="thread-item-"]').forEach(el => {
            el.classList.remove('bg-indigo-50', 'border-l-4', 'border-l-indigo-600');
        });
        element.classList.add('bg-indigo-50', 'border-l-4', 'border-l-indigo-600');

        activeThreadId = thread.Id;
        loadMessages(thread);
    };

    const loadMessages = async (thread) => {
        chatPanel.innerHTML = ""; // Clear panel
        renderLoading(chatPanel, "Loading messages...");

        // Chat Header
        const chatHeader = document.createElement('div');
        chatHeader.className = "p-4 border-b border-slate-200 bg-white flex flex-col z-10 shadow-sm";
        chatHeader.innerHTML = `
            <h3 class="font-bold text-slate-800 text-lg">${thread.Subject}</h3>
            <span class="text-xs text-slate-500">Thread ID: ${thread.Id}</span>
        `;

        // Chat History Area
        const chatHistory = document.createElement('div');
        chatHistory.className = "flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col gap-4 bg-slate-50/50";

        // Input Area
        const inputArea = document.createElement('div');
        inputArea.className = "p-4 border-t border-slate-200 bg-white flex gap-3 items-end";

        const inputField = document.createElement('textarea');
        inputField.className = "flex-1 border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none min-h-[50px] max-h-[150px] text-sm custom-scrollbar";
        inputField.placeholder = "Type your reply here...";
        inputField.rows = 2;

        const sendBtn = document.createElement('button');
        sendBtn.className = "bg-indigo-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-sm whitespace-nowrap";
        sendBtn.innerText = "Send Reply";

        sendBtn.addEventListener('click', () => submitReply(inputField, chatHistory));

        try {
            // Fetch child payloads where ThreadId matches
            const filters = [{ field: 'ThreadId', operator: '=', value: activeThreadId }];
            const messages = await fetchQuery(childDataSource, ['Id', 'Body', 'SenderType', 'SenderId', 'SentAt'], filters);
            chatHistory.innerHTML = ""; // Clear loading

            if (messages.length === 0) {
                chatHistory.innerHTML = `<div class="m-auto text-sm text-slate-400 font-medium">No messages in this thread yet.</div>`;
            } else {
                // Sort chronologically
                messages.sort((a, b) => new Date(a.SentAt) - new Date(b.SentAt));
                messages.forEach(msg => chatHistory.appendChild(createMessageBubble(msg)));
            }

            chatPanel.appendChild(chatHeader);
            chatPanel.appendChild(chatHistory);

            inputArea.appendChild(inputField);
            inputArea.appendChild(sendBtn);
            chatPanel.appendChild(inputArea);

            // Auto-scroll to bottom
            chatHistory.scrollTop = chatHistory.scrollHeight;

        } catch (error) {
            renderError(chatPanel, "Failed to load messages.");
        }
    };

    const createMessageBubble = (msg) => {
        const wrapper = document.createElement('div');
        const isProvider = msg.SenderType === 'Provider';

        // Align left for Patient/System, align right for Provider
        wrapper.className = `max-w-[75%] flex flex-col ${isProvider ? 'self-end items-end' : 'self-start items-start'}`;
        const bubble = document.createElement('div');
        bubble.className = `p-4 rounded-2xl text-sm shadow-sm ${
            isProvider
                ? 'bg-indigo-600 text-white rounded-br-sm'
                : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'
        }`;
        bubble.innerText = msg.Body || ""; // Secure against XSS by using innerText

        const meta = document.createElement('div');
        meta.className = "text-[10px] text-slate-400 mt-1 px-1 font-medium";
        const timeString = msg.SentAt ? new Date(msg.SentAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "";
        meta.innerText = `${msg.SenderType} • ${timeString}`;

        wrapper.appendChild(bubble);
        wrapper.appendChild(meta);
        return wrapper;
    };

    const submitReply = async (inputField, chatHistoryContainer) => {
        const text = inputField.value.trim();
        if (!text || !activeThreadId) return;

        inputField.disabled = true;
        const currentUser = document.getElementById('currentUser')?.innerText || 'System';

        const payload = {
            ThreadId: activeThreadId,
            Body: text,
            SenderType: "Provider",
            SenderId: currentUser,
            SentAt: new Date().toISOString(),
            IsRead: true
        };
        try {
            // Re-use your Kanban executeAction logic
            await executeAction(childDataSource, [payload]);
            inputField.value = "";

            // Optimistically append the bubble
            chatHistoryContainer.appendChild(createMessageBubble(payload));
            chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;

        } catch (error) {
            alert(`Failed to send message: ${error.message}`);
        } finally {
            inputField.disabled = false;
            inputField.focus();
        }
    };

    // Initialize View
    chatPanel.innerHTML = `<div class="m-auto text-slate-400 font-medium">Select a conversation from the sidebar.</div>`;
    mainContainer.appendChild(sidebar);
    mainContainer.appendChild(chatPanel);

    loadThreads();

    return mainContainer;
};

