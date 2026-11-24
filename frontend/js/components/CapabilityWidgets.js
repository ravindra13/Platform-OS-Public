// js/components/CapabilityWidgets.js
import { getHeaders, fetchThreadMessages, postThreadMessage, fetchAuditLedger } from '../services/api.js';

export const FileAttachmentWidget = (schema) => {
    const div = document.createElement('div');
    div.className = "flex flex-col h-full justify-center items-center text-slate-400 p-8";
    div.innerHTML = `
        <div class="text-4xl mb-4">📎</div>
        <h3 class="font-bold text-slate-700">Secure Files</h3>
        <p class="text-sm text-center mt-2">Drag and drop files here to attach them to this record.</p>
    `;
    return div;
};

export const ThreadChatWidget = (schema) => {
    const container = document.createElement('div');
    container.className = "flex flex-col h-full bg-white rounded-xl flex-1 relative";

    const { parentRecordId, parentObjectType } = schema;

    if (!parentRecordId || !parentObjectType) {
        container.innerHTML = `<div class="p-4 text-rose-500 font-bold">Missing Parent Context</div>`;
        return container;
    }

    const chatHistory = document.createElement('div');
    chatHistory.className = "flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-3 bg-slate-50/50";

    const inputArea = document.createElement('div');
    inputArea.className = "p-3 border-t border-slate-100 flex gap-2 items-end bg-white";

    const inputField = document.createElement('textarea');
    inputField.className = "flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none max-h-[100px] custom-scrollbar";
    inputField.placeholder = "Type a message...";
    inputField.rows = 1;

    const sendBtn = document.createElement('button');
    sendBtn.className = "bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50";
    sendBtn.innerText = "Send";

    const currentUserId = getHeaders()['x-user-id'] || 'System';

    let pollInterval = null;
    let currentMessageCount = -1; // State-driven count to fix the DOM counting bug

    // --- RENDER LOGIC (No raw fetch calls!) ---
    const loadChat = async () => {
        try {
            // Call the centralized api.js function
            const messages = await fetchThreadMessages(parentObjectType, parentRecordId);

            if (currentMessageCount !== messages.length) {
                currentMessageCount = messages.length;

                chatHistory.innerHTML = "";
                if (messages.length === 0) {
                    chatHistory.innerHTML = `<div class="m-auto text-sm text-slate-400 font-medium">Secure channel open. Start typing below.</div>`;
                } else {
                    messages.forEach(msg => chatHistory.appendChild(createBubble(msg)));
                    chatHistory.scrollTop = chatHistory.scrollHeight;
                }
            }
        

            if (!pollInterval) {
                pollInterval = setInterval(loadChat, 3000);
            }
        } catch (error) {
            console.error("Chat sync failed:", error);
        }
    };

    const createBubble = (msg) => {
        const wrapper = document.createElement('div');
        const isRight = msg.SenderId === currentUserId;

        wrapper.className = `max-w-[85%] flex flex-col ${isRight ? 'self-end items-end' : 'self-start items-start'} mb-1`;

        const bubble = document.createElement('div');
        bubble.className = `px-3 py-2 rounded-xl text-sm shadow-sm ${
            isRight ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'
        }`;
        bubble.innerText = msg.Body || "";

        const meta = document.createElement('div');
        meta.className = "text-[9px] text-slate-400 mt-1 px-1 font-medium";

        const timeString = new Date(msg.Timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        meta.innerText = `${msg.SenderId} • ${timeString}`;

        wrapper.appendChild(bubble);
        wrapper.appendChild(meta);
        return wrapper;
    };
    const submitMessage = async () => {
        const text = inputField.value.trim();
        if (!text) return;

        inputField.disabled = true;
        sendBtn.disabled = true;

        try {
            // Call the centralized api.js function
            await postThreadMessage(parentObjectType, parentRecordId, text);
            inputField.value = "";
            await loadChat();
        } catch (error) {
            alert(`Failed to send message: ${error.message}`);
        } finally {
            inputField.disabled = false;
            sendBtn.disabled = false;
            inputField.focus();
        }
    };

    sendBtn.addEventListener('click', submitMessage);
    inputField.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitMessage();
        }
    });

    const observer = new MutationObserver(() => {
        if (!document.body.contains(container)) clearInterval(pollInterval);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    container.appendChild(chatHistory);
    inputArea.appendChild(inputField);
    inputArea.appendChild(sendBtn);
    container.appendChild(inputArea);

    chatHistory.innerHTML = `<div class="m-auto text-sm text-slate-400 font-medium">Loading conversation...</div>`;
    loadChat();

    return container;
};




export const AuditHistoryWidget = (schema) => {
    const container = document.createElement('div');
    container.className = "flex flex-col h-full bg-white rounded-xl flex-1 relative";

    const { parentRecordId, parentObjectType } = schema;

    if (!parentRecordId || !parentObjectType) {
        container.innerHTML = `<div class="p-4 text-rose-500 font-bold">Missing Parent Context</div>`;
        return container;
    }

    const header = document.createElement('div');
    header.className = "p-4 border-b border-slate-100 bg-white font-bold text-slate-700 flex justify-between items-center";
    header.innerHTML = `<span>Audit Ledger</span><button id="refresh-audit" class="text-xs text-indigo-500 hover:text-indigo-700">Refresh</button>`;

    const timelineContainer = document.createElement('div');
    timelineContainer.className = "flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-50/50";
    const timeline = document.createElement('div');
    timeline.className = "relative border-l-2 border-slate-200 ml-3 space-y-6";
    timelineContainer.appendChild(timeline);

    container.appendChild(header);
    container.appendChild(timelineContainer);

    const ignoredFields = ['SystemModstamp', 'LastModifiedDate', 'LastModifiedById', 'CreatedDate', 'CreatedById'];

    // --- RENDER LOGIC (No raw fetch calls!) ---
    const loadAuditTrail = async () => {
        try {
            timeline.innerHTML = `<div class="ml-6 text-sm text-slate-400">Loading ledger...</div>`;

            // Call the centralized api.js function
            let history = await fetchAuditLedger(parentObjectType, parentRecordId);

            timeline.innerHTML = "";

            if (history.length === 0) {
                timeline.innerHTML = `<div class="ml-6 text-sm text-slate-400">No history found for this record.</div>`;
                return;
            }

            history = history.reverse();

            history.forEach(log => {
                const item = document.createElement('div');
                item.className = "relative pl-6";

                const timeString = new Date(log.timestamp).toLocaleString();
                const isCreate = log.action === 'CREATE';
                const iconColor = isCreate ? 'bg-emerald-500' : 'bg-blue-500';

                const meaningfulDeltas = (log.deltas || []).filter(d => !ignoredFields.includes(d.field_name));

                item.innerHTML = `
                    <div class="absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-2 border-white ${iconColor} shadow-sm"></div>
                    <div class="flex flex-col mb-1">
                        <span class="text-sm font-bold text-slate-800">${log.actor_id}</span>
                        <span class="text-xs font-medium text-slate-500">${log.action} • ${timeString}</span>
                    </div>
                    ${meaningfulDeltas.length > 0 ? `
                        <div class="mt-2 text-xs bg-white p-3 rounded-lg border border-slate-200 shadow-sm font-mono text-slate-600 overflow-x-auto space-y-1">
                            ${meaningfulDeltas.map(d => `
                                <div>
                                    <span class="font-bold text-slate-700">${d.field_name}:</span>
                                    <span class="line-through text-rose-400">${d.old_value !== null ? d.old_value : 'null'}</span>
                                    <span class="text-emerald-500 font-bold">➔</span>${d.new_value !== null ? d.new_value : 'null'}
                                </div>
                            `).join("")}
                        </div>
                    ` : (isCreate ? `<div class="mt-1 text-xs text-slate-400 italic">Record initialized.</div>` : "")}
                `;
                timeline.appendChild(item);
            });
        } catch (error) {
            console.error(error);
            timeline.innerHTML = `<div class="ml-6 text-sm text-rose-500">Failed to load audit history.</div>`;
        }
    };
    header.querySelector('#refresh-audit').onclick = loadAuditTrail;
    loadAuditTrail();

    return container;
};
