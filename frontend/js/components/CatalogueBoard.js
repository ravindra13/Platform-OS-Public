// js/components/CatalogueBoard.js
import { fetchQuery, executeAction } from '../services/api.js';
import { renderLoading, renderError } from '../utils/ui.js';

export const CatalogueBoard = (schema) => {
    const mainContainer = document.createElement('div');
    mainContainer.className = "flex h-full w-full gap-6";

    // --- LOCAL STATE (THE CART) ---
    let cart = {}; // { "PROD-123": { id, title, price, qty } }

    // --- LAYOUT SETUP ---
    const productSection = document.createElement('div');
    productSection.className = "flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar";

    const cartSection = document.createElement('div');
    cartSection.className = "w-[400px] bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col shadow-sm h-full flex-shrink-0";

    mainContainer.appendChild(productSection);
    mainContainer.appendChild(cartSection);

    // --- 1. RENDER CART ---
    const renderCart = () => {
        const cartItems = Object.values(cart);
        const totalAmount = cartItems.reduce((sum, item) => sum + (item.price * item.qty), 0);

        cartSection.innerHTML = `
            <h3 class="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Current Order</h3>
            
            <div class="flex-1 overflow-y-auto flex flex-col gap-3 custom-scrollbar" id="cart-items">
                ${cartItems.length === 0 ? '<div class="text-sm text-slate-400 text-center mt-10">Cart is empty</div>' : ''}
                ${cartItems.map(item => `
                    <div class="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                        <div class="flex flex-col flex-1 mr-2">
                            <span class="text-sm font-bold text-slate-700 line-clamp-1">${item.title}</span>
                            <span class="text-xs font-semibold text-slate-500">$${item.price} / ea</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <div class="flex items-center border border-slate-200 rounded-md bg-slate-50">
                                <button class="px-2 py-1 text-slate-500 hover:bg-slate-200 font-bold transition-colors" data-action="decrement" data-id="${item.id}">-</button>
                                <span class="w-6 text-center text-sm font-bold text-slate-700">${item.qty}</span>
                                <button class="px-2 py-1 text-slate-500 hover:bg-slate-200 font-bold transition-colors" data-action="increment" data-id="${item.id}">+</button>
                            </div>
                            <span class="font-black text-slate-800 w-14 text-right">$${(item.price * item.qty).toFixed(2)}</span>
                            <button class="text-rose-500 hover:bg-rose-50 p-1.5 rounded-md font-bold text-xs border border-rose-100 transition-colors" data-remove-id="${item.id}">X</button>
                        </div>
                    </div>
                `).join('')}
            </div>

            <div class="mt-4 pt-4 border-t border-slate-200">
                <div class="flex justify-between items-center mb-4">
                    <span class="font-bold text-slate-500 uppercase tracking-wider text-xs">Total Amount</span>
                    <span class="text-2xl font-black text-indigo-600">$${totalAmount.toFixed(2)}</span>
                </div>
                <button id="checkout-btn" class="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-lg hover:bg-indigo-700 transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed" ${cartItems.length === 0 ? 'disabled' : ''}>
                    Complete Checkout
                </button>
            </div>
        `;
    };

    // --- 2. FETCH & RENDER PRODUCTS ---
    const fetchProducts = async () => {
        renderLoading(productSection, "Loading catalogue...");
        try {
            const fields = ["Id", schema.productMapping.titleField, schema.productMapping.priceField];
            if (schema.productMapping.imageField) fields.push(schema.productMapping.imageField);

            const products = await fetchQuery(schema.dataSource, fields, schema.filters || []); 
            
            productSection.innerHTML = `
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-10">
                    ${products.map(p => `
                        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer flex flex-col group active:scale-95" data-product-id="${p.Id}">
                            ${schema.productMapping.imageField && p[schema.productMapping.imageField] ? `<img src="${p[schema.productMapping.imageField]}" class="w-full h-32 object-cover rounded-md mb-3" />` : '<div class="w-full h-32 bg-slate-50 rounded-md mb-3 flex items-center justify-center text-slate-400 font-semibold text-xs border border-slate-100 uppercase tracking-widest">No Image</div>'}
                            <span class="font-bold text-slate-700 text-sm line-clamp-2 group-hover:text-indigo-600 transition-colors">${p[schema.productMapping.titleField]}</span>
                            <span class="text-indigo-600 font-black mt-2 text-lg">$${p[schema.productMapping.priceField] || 0}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (error) {
            renderError(productSection, "Failed to load products.");
        }
    };

    // --- 3. EVENT DELEGATION ---
    mainContainer.addEventListener('click', async (e) => {
        // Add to Cart from Grid
        const productCard = e.target.closest('[data-product-id]');
        if (productCard) {
            const id = productCard.dataset.productId;
            const title = productCard.querySelector('span.line-clamp-2').innerText;
            const priceText = productCard.querySelector('span.text-indigo-600').innerText;
            const price = parseFloat(priceText.replace('$', ''));

            if (cart[id]) cart[id].qty += 1;
            else cart[id] = { id, title, price, qty: 1 };
            
            renderCart();
            return;
        }

        // Cart Actions (+, -, Remove)
        const actionBtn = e.target.closest('[data-action]');
        if (actionBtn) {
            const id = actionBtn.dataset.id;
            const action = actionBtn.dataset.action;
            
            if (action === 'increment') {
                cart[id].qty += 1;
            } else if (action === 'decrement') {
                if (cart[id].qty > 1) cart[id].qty -= 1;
                else delete cart[id];
            }
            renderCart();
            return;
        }

        const removeBtn = e.target.closest('[data-remove-id]');
        if (removeBtn) {
            delete cart[removeBtn.dataset.removeId];
            renderCart();
            return;
        }

        // Checkout Process
        if (e.target.id === 'checkout-btn') {
            await handleCheckout(e.target);
        }
    });

    // --- 4. CONFIGURABLE TRANSACTION LOGIC ---
    const handleCheckout = async (btn) => {
        btn.disabled = true;
        btn.innerText = "Processing...";
        const cartItems = Object.values(cart);
        const cfg = schema.checkoutConfig;
        
        try {
            // STEP 1: Create Order Header in DRAFT state
            const orderPayload = {
                [cfg.totalAmountField || "Total_Amount"]: cartItems.reduce((sum, item) => sum + (item.price * item.qty), 0),
            };
            if (cfg.statusField && cfg.draftStatusValue) {
                orderPayload[cfg.statusField] = cfg.draftStatusValue;
            }
            
            const orderResult = await executeAction(cfg.orderObject, orderPayload);
            const newOrderId = Array.isArray(orderResult) ? orderResult[0].Id : orderResult.Id;
            if (!newOrderId) throw new Error("Failed to generate Order ID.");

            // STEP 2: Batch Create Line Items
            const lineItemsPayload = cartItems.map(item => ({
                [cfg.orderRelationshipField]: newOrderId,
                [cfg.productRelationshipField]: item.id,
                [cfg.quantityField || "Quantity"]: item.qty,
                [cfg.unitPriceField || "Unit_Price"]: item.price 
            }));

            await executeAction(cfg.lineItemObject, lineItemsPayload);

            // STEP 3: Complete the Order
            if (cfg.statusField && cfg.completedStatusValue) {
                await executeAction(cfg.orderObject, {
                    "Id": newOrderId,
                    [cfg.statusField]: cfg.completedStatusValue
                });
            }

            // Cleanup on success
            if (window.showToast) window.showToast("Order placed successfully!", "success");
            cart = {}; 
            renderCart();
            
        } catch (error) {
            console.error("Checkout Transaction Failed:", error);
            // Error toast is handled globally by api_2.js interceptor
        } finally {
            btn.disabled = cartItems.length === 0;
            btn.innerText = "Complete Checkout";
        }
    };

    // --- INITIALIZE ---
    fetchProducts();
    renderCart();

    return mainContainer;
};