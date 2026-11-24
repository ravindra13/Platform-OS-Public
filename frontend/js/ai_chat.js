// js/ai_chat.js
import { URLState } from './helper.js';
import { initRouter } from './router.js';

let conversationHistory = [];

function toggleAIChat() {
    const panel = document.getElementById('ai-copilot-panel');
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        panel.classList.add('flex');
        document.getElementById('ai-prompt-input').focus();
    } else {
        panel.classList.add('hidden');
        panel.classList.remove('flex');
    }
}

const aiInput = document.getElementById('ai-prompt-input');
if (aiInput) {
    aiInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    aiInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendAIPrompt();
        }
    });
}

// Architecturally Pure Context Reader
function getCurrentUIContext() {
    const state = URLState.get();

    // 1. Check if the Slide-Over Record Edit Panel is currently open
    const recordPanel = document.getElementById('recordPanel');
    const isSlideOverOpen = recordPanel && !recordPanel.classList.contains('translate-x-full');
    const slideOverRecordId = isSlideOverOpen ? document.getElementById('recordPanelTitle')?.innerText : null;

    // 2. If no object is active, the user is on the Home Dashboard
    if (!state.object) {
        return {
            viewing_type: "Home Dashboard",
            active_object: null
        };
    }

    // 3. Construct exact snapshot from URLState + Slide-Over state
    const activeRecordId = slideOverRecordId || state.recordId || null;

    return {
        viewing_type: activeRecordId ? "Record Detail / Edit View" : "Object View",
        active_object: state.object,
        active_view: state.view || "list",
        active_record_id: activeRecordId,
        active_filters: state.filters || []
    };
}



async function sendAIPrompt() {
    const inputElement = document.getElementById('ai-prompt-input');
    const sendButton = document.getElementById('send-prompt-btn');
    const promptText = inputElement.value.trim();

    if (!promptText) return;

    appendAIMessage('USER', promptText);
    conversationHistory.push({ role: "user", content: promptText });

    inputElement.value = '';
    inputElement.style.height = 'auto';
    inputElement.disabled = true;
    sendButton.disabled = true;

    const thinkingId = appendAIMessage('SYSTEM', 'Processing request...', true);

    try {
        const tenantId = document.getElementById('currentTenant')?.innerText || 'TENANT-ACME';
        const userId = document.getElementById('currentUser')?.innerText || 'USER-ALICE';
        const currentUIContext = getCurrentUIContext(); 

        const response = await fetch('/api/ai/prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-tenant-id': tenantId,
                'x-user-id': userId,
                'x-execution-mode': 'SYSTEM'
            },
            body: JSON.stringify({ 
                prompt: promptText, 
                history: conversationHistory,
                current_context: currentUIContext 
            })
        });

        const result = await response.json();
        document.getElementById(thinkingId)?.remove();

        if (!response.ok) {
            conversationHistory.pop(); 
            throw new Error(result.detail || 'Failed to process AI request.');
        }

        // // --- THE ARCHITECTURE UPGRADE: CLIENT-SIDE TOOL EXECUTION ---
        // if (result.type === 'ui_command' && result.command === 'ui_navigate') {
        //     const { action, target_object, record_id, modal_type } = result.args;
            
        //     // Append a friendly message to the chat
        //     conversationHistory.push({ role: "assistant", content: result.answer });
        //     appendAIMessage('AI', result.answer);

        //     // Execute the navigation using your native router and state manager!
        //     if (action === 'VIEW_RECORD') {
        //         // Must set the recordId in URLState first so router.js picks it up
        //         URLState.set({ object: target_object, view: 'detail', recordId: record_id });
        //         initRouter(target_object, 'detail');
        //     } else if (action === 'VIEW_LIST') {
        //         // Clear the recordId and navigate to the list view
        //         URLState.set({ object: target_object, view: 'list', recordId: null });
        //         initRouter(target_object, 'list');
        //     } else if (action === 'OPEN_MODAL') {
        //         if (modal_type === 'IMPORT' || modal_type === 'EXPORT') {
        //             // Trigger your native Data Migration Modal from index.html
        //             if (typeof window.toggleMigrationModal === 'function') {
        //                 window.toggleMigrationModal();
        //             }
        //         }
        //     }
        //     return; // Stop processing, we are done!
        // }
        // // --- END UPGRADE ---



        let finalAnswer = result.answer;
        let requiresUIRefresh = false;

        if (finalAnswer.includes('[REFRESH]')) {
            requiresUIRefresh = true;
            finalAnswer = finalAnswer.replace('[REFRESH]', '').trim(); 
        }

        conversationHistory.push({ role: "assistant", content: finalAnswer });
        appendAIMessage('AI', finalAnswer);

        if (requiresUIRefresh) {
            window.dispatchEvent(new CustomEvent('PlatformDataChanged', { 
                detail: { source: 'ai_copilot', timestamp: Date.now() }
            }));
        }

    } catch (error) {
        document.getElementById(thinkingId)?.remove();
        appendAIMessage('ERROR', error.message);
    } finally {
        inputElement.disabled = false;
        sendButton.disabled = false;
        inputElement.focus();
    }
}

// function appendAIMessage(sender, text, isThinking = false) {
//     const chatHistory = document.getElementById('ai-chat-history');
//     const messageId = 'msg-' + Date.now();
//     const formattedText = text.replace(/\n/g, '<br>');

//     const msgWrapper = document.createElement('div');
//     msgWrapper.id = messageId;
//     msgWrapper.className = `flex flex-col gap-1.5 ${sender === 'USER' ? 'max-w-[85%] self-end' : 'max-w-[95%] self-start'}`;

//     let labelClass = sender === 'USER' ? 'text-indigo-400 text-right mr-1' : 'text-slate-400 ml-1';
//     let bubbleClass = '';

//     if (sender === 'USER') {
//         bubbleClass = 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm shadow-sm';
//     } else if (sender === 'ERROR') {
//         bubbleClass = 'bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl rounded-tl-sm';
//     } else {
//         bubbleClass = `bg-white border border-slate-200 text-slate-700 rounded-2xl rounded-tl-sm shadow-sm ${isThinking ? 'animate-pulse' : ''}`;
//     }

//     msgWrapper.innerHTML = `
//         <div class="text-[10px] font-bold uppercase tracking-widest ${labelClass}">${sender}</div>
//         <div class="p-4 text-[13px] leading-relaxed font-medium ${bubbleClass}">
//             ${formattedText}
//         </div>
//     `;

//     chatHistory.appendChild(msgWrapper);
//     chatHistory.scrollTo({
//         top: chatHistory.scrollHeight,
//         behavior: 'smooth'
//     });
    
//     return messageId;
// }

function appendAIMessage(sender, text, isThinking = false) {
    const chatHistory = document.getElementById('ai-chat-history');
    const messageId = 'msg-' + Date.now();

    // 1. Process Markdown for AI messages, keep plain text for User/Error
    let formattedText = '';
    if (sender === 'AI' || sender === 'SYSTEM') {
        // Fallback to basic line breaks if marked isn't loaded yet
        formattedText = typeof marked !== 'undefined' 
            ? marked.parse(text) 
            : text.replace(/\n/g, '<br>');
    } else {
        formattedText = text.replace(/\n/g, '<br>');
    }

    const msgWrapper = document.createElement('div');
    msgWrapper.id = messageId;
    msgWrapper.className = `flex flex-col gap-1.5 ${sender === 'USER' ? 'max-w-[85%] self-end' : 'max-w-[95%] self-start'}`;

    let labelClass = sender === 'USER' ? 'text-indigo-400 text-right mr-1' : 'text-slate-400 ml-1';
    let bubbleClass = '';

    if (sender === 'USER') {
        bubbleClass = 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm shadow-sm';
    } else if (sender === 'ERROR') {
        bubbleClass = 'bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl rounded-tl-sm';
    } else {
        // 2. Added Tailwind arbitrary variants to style the injected Markdown HTML
        bubbleClass = `bg-white border border-slate-200 text-slate-700 rounded-2xl rounded-tl-sm shadow-sm 
            [&_p]:mb-2 last:[&_p]:mb-0 
            [&_pre]:bg-slate-800 [&_pre]:text-slate-50 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:text-xs
            [&_code]:text-indigo-600 [&_code]:bg-indigo-50 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
            [&_pre>code]:text-inherit [&_pre>code]:bg-transparent [&_pre>code]:p-0
            [&_strong]:text-slate-900
            ${isThinking ? 'animate-pulse' : ''}`;
    }

    msgWrapper.innerHTML = `
        <div class="text-[10px] font-bold uppercase tracking-widest ${labelClass}">${sender}</div>
        <div class="p-4 text-[13px] leading-relaxed font-medium overflow-hidden ${bubbleClass}">
            ${formattedText}
        </div>
    `;

    chatHistory.appendChild(msgWrapper);
    chatHistory.scrollTo({
        top: chatHistory.scrollHeight,
        behavior: 'smooth'
    });
    
    return messageId;
}


// Explicitly bind functions called by inline HTML onclick="..." handlers
window.toggleAIChat = toggleAIChat;
window.sendAIPrompt = sendAIPrompt;

// Add the initial greeting here:
// appendAIMessage('AI', "Hello! I am your Enterprise AI Orchestrator. You can ask me to inspect schemas, query records, update layouts, or deploy entire apps. How can I help you today?");
appendAIMessage('AI', "Hello! I am your AI Business Architect. I'm here to help you build a custom system to run your operations. To get started, what kind of business do you run, and what is the main process you want to organize today?");