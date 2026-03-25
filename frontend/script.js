// Leave empty if frontend and backend are hosted together on the same Render service
const PRODUCTION_BACKEND_URL = ''; 

// Automatically adapt to production domain, or use localhost:3000 for local dev
const API_BASE_URL = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' ? 'http://localhost:3000' : (PRODUCTION_BACKEND_URL || window.location.origin);

function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[tag] || tag));
}

function getDefaultImage(itemName) {
    if (!itemName) return 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=400&q=80';
    if (itemName.includes('Halwa') || itemName.includes('Dessert')) return 'https://images.unsplash.com/photo-1563805042-7684c8e9e9cb?auto=format&fit=crop&w=400&q=80';
    if (itemName.includes('Rice') || itemName.includes('Pulao') || itemName.includes('Biryani')) return 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?auto=format&fit=crop&w=400&q=80';
    if (itemName.includes('Roti') || itemName.includes('Naan') || itemName.includes('Paratha') || itemName.includes('Poori')) return 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=400&q=80';
    if (itemName.includes('Paneer') || itemName.includes('Masala') || itemName.includes('Curry')) return 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=400&q=80';
    if (itemName.includes('Fries') || itemName.includes('Snack')) return 'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&w=400&q=80';
    if (itemName.includes('Thali') || itemName.includes('Meal') || itemName.includes('Combo')) return 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=400&q=80';
    return 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=400&q=80';
}

document.addEventListener('DOMContentLoaded', () => {
    const navbar = document.getElementById('navbar');
    const mobileMenu = document.getElementById('mobile-menu');
    const navLinks = document.querySelector('.nav-links');

    // Dynamic Footer Copyright Year
    const currentYearEl = document.getElementById('current-year');
    if (currentYearEl) {
        currentYearEl.textContent = new Date().getFullYear();
    }

    if (mobileMenu && navLinks) {
        mobileMenu.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            navbar.classList.toggle('menu-open');
        });
        navLinks.addEventListener('click', (e) => {
            if(e.target.tagName === 'A') {
                navLinks.classList.remove('active');
                navbar.classList.remove('menu-open');
            }
        });
    }

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    updateCartCount();
    
    // On the homepage, load all the dynamic menu sections
    if (window.location.pathname === '/' || window.location.pathname.endsWith('index.html')) {
        loadMenu();
        showStickyCart();
    }

    if(window.location.pathname.includes('cart.html')) {
        renderCart();
    }

    if(window.location.pathname.includes('admin.html')) {
        let user = null;
        try {
            user = JSON.parse(localStorage.getItem('loggedInUser'));
        } catch(e) {}
        
        const token = localStorage.getItem('authToken');
        
        if (!user || user.role !== 'admin' || !token) {
            showCustomAlert('Access Denied. Administrator login required.', () => { 
                localStorage.removeItem('loggedInUser');
                localStorage.removeItem('authToken');
                window.location.href = 'login.html'; 
            });
        } else {
            // Initialize theme
            if (localStorage.getItem('theme') === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
            
            // Load initial view
            switchAdminTab('tab-dashboard');
        }
    }

    if(window.location.pathname.includes('my-orders.html')) {
        let user = null;
        try { user = JSON.parse(localStorage.getItem('loggedInUser')); } catch(e) {}

        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('session_id');
        
        if (sessionId) {
            verifyStripeSession(sessionId).then(() => {
                window.history.replaceState({}, document.title, window.location.pathname);
                localStorage.removeItem('cart');
                updateCartCount();
                loadMyOrders();
            });
        } else {
            loadMyOrders();
        }
    }

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('sub_success') === 'true') {
        showCustomAlert('Payment successful! Your subscription is now Active. 🎉');
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    if(window.location.pathname.includes('profile.html')) {
        let user = null;
        try { user = JSON.parse(localStorage.getItem('loggedInUser')); } catch(e) {}

        if (!user || !localStorage.getItem('authToken')) {
            window.location.href = 'login.html';
        } else {
            loadProfile();
        }
    }

    if (window.location.pathname.includes('payment.html')) {
        initializePaymentPage();
    }

    if (window.location.pathname.includes('login.html')) {
        initializeGoogleLogin();
    }

    updateAuthNav();

    // WebSocket Integration for real-time updates
    if (typeof io !== 'undefined') {
        const socket = io(API_BASE_URL);
        socket.on('orderUpdate', (data) => {
            if(window.location.pathname.includes('admin.html')) {
                if (data && data.type === 'NEW_ORDER') {
                    const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
                    audio.play().catch(err => console.log('Audio autoplay blocked by browser:', err));
                }
                if (data && data.type === 'NEW_SUBSCRIPTION' && data.subscription) {
                    const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
                    audio.play().catch(err => console.log('Audio autoplay blocked by browser:', err));
                    
                    const sub = data.subscription;
                    const startDate = new Date(sub.startDate).toLocaleDateString('en-IN', { dateStyle: 'medium' });
                    const message = `Hi ${sub.customerName}, thank you for subscribing to Kajal Ki Rasoi! 🎉 Your ${sub.plan} is Active and deliveries start from ${startDate}.`;
                    const cleanContact = (sub.contact || '').replace(/\D/g, '');
                    const waPhone = cleanContact.length === 10 ? '91' + cleanContact : cleanContact;
                    const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;
                    
                    showCustomAlert(`New Paid Subscription from ${sub.customerName}! Click OK to send them a Welcome WhatsApp.`, () => window.open(waUrl, '_blank'));
                }
                loadAdminOrders();
                if (typeof loadAdminSubscriptions === 'function') loadAdminSubscriptions();
                loadAdminDashboardStats();
            } else if(window.location.pathname.includes('my-orders.html')) {
                if (data && data.type === 'ORDER_COMPLETED') {
                    showCustomAlert('Your order has been delivered! Please consider leaving a review.');
                }
                loadMyOrders();
            }
        });
    }
});

function orderItem(itemName, price) {
    const token = localStorage.getItem('authToken');
    if (!token) {
        showCustomAlert('Please login to add items to your cart.', () => {
            window.location.href = 'login.html';
        });
        return;
    }

    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    let existing = cart.find(i => i.name === itemName);
    if (existing) {
        existing.quantity = (existing.quantity || 1) + 1;
    } else {
        cart.push({ name: itemName, price: price, quantity: 1 });
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    
    updateCartCount();
    if (typeof showStickyCart === 'function') showStickyCart();
    
    const cartIcon = document.querySelector('.nav-cart-icon');
    if (cartIcon) {
        cartIcon.classList.remove('cart-bump');
        void cartIcon.offsetWidth; // trigger reflow to restart animation
        cartIcon.classList.add('cart-bump');
    }

    showCustomAlert(`Great choice! ${itemName} has been added to your cart.`);
}

function showStickyCart() {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    let sticky = document.getElementById('sticky-cart');
    if (!sticky) return;
    const token = localStorage.getItem('authToken');
    
    if (cart.length > 0 && token) {
        let count = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
        let total = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
        sticky.innerHTML = `
            <div style="display:flex; justify-content: space-between; align-items: center; width: 100%; max-width: 1200px; margin: 0 auto;">
                <span style="font-size: 1.1rem; font-weight: bold;">🛒 ${count} items | ₹${total}</span>
                <button onclick="window.location.href='cart.html'" class="btn" style="padding: 8px 20px; font-size: 1rem; background: #2ecc71; color: white;">View Cart &rarr;</button>
            </div>
        `;
        sticky.style.display = 'block';
    } else {
        sticky.style.display = 'none';
    }
}

let allMenuItems = []; // To store all menu items for filtering

function generateMenuItemHTML(item) {
    const safeName = escapeHTML(item.name);
    const itemImage = item.imageUrl && item.imageUrl.trim() !== '' ? escapeHTML(item.imageUrl) : getDefaultImage(safeName);
    const isBestseller = safeName.includes('Thali') || safeName.includes('Paneer') || safeName.includes('Biryani');
    const isRecommended = item.category === "🌟 Today's Special";
    const isVeg = !safeName.toLowerCase().includes('chicken') && !safeName.toLowerCase().includes('egg');
    const urgency = Math.random() > 0.85 && item.available !== false ? `<span class="urgency-text">🔥 Only a few left!</span>` : '';
    const isAvailable = item.available !== false;
    
    const buttonHtml = isAvailable ? `<button class="btn-order" onclick="orderItem('${safeName.replace(/'/g, "\\'")}', ${item.price})">＋ Add</button>` : `<button class="btn-order" style="background-color: #95a5a6; cursor: not-allowed;" disabled>Sold Out</button>`;
    
    let tagHtml = '';
    if (isRecommended && isAvailable) {
        tagHtml = '<span class="badge badge-recommended">🔥 Recommended</span>';
    } else if (isBestseller && isAvailable) {
        tagHtml = '<span class="badge badge-bestseller">⭐ Best Seller</span>';
    }
    
    return `
        <div class="menu-card ${!isAvailable ? 'item-unavailable' : ''}">
            <div class="card-img-container">
                <img src="${itemImage}" alt="${safeName}" class="card-img" loading="lazy">
                ${tagHtml}
                ${isVeg && isAvailable ? '<span class="badge badge-veg">🌱 Veg</span>' : ''}
                ${!isAvailable ? '<span class="badge badge-sold-out">Sold Out</span>' : ''}
            </div>
            <div class="card-content">
                <div class="card-title-row">
                    <h3>${safeName}</h3>
                    ${item.rating ? `<span class="rating-badge">★ ${item.rating.toFixed(1)}</span>` : ''}
                </div>
                <p class="card-description">${escapeHTML(item.description || '')}</p>
                ${urgency}
                <div class="card-footer">
                    <span class="price">₹${item.price}</span>
                    ${buttonHtml}
                </div>
            </div>
        </div>
    `;
}

async function loadMenu() {
    const container = document.getElementById('dynamic-menu-container');
    if (!container) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/menu`);
        const menuItems = await response.json();

        if (!Array.isArray(menuItems) || menuItems.length === 0) {
            container.innerHTML = '<p class="empty-cart">Menu is currently unavailable.</p>';
            return;
        }

        allMenuItems = menuItems; // Store for filtering
        renderFilteredMenu(); // Initial render

        // Add event listeners for filters
        document.querySelectorAll('input[name="veg-filter"]').forEach(radio => {
            radio.addEventListener('change', renderFilteredMenu);
        });
        document.getElementById('price-filter').addEventListener('change', renderFilteredMenu);
        document.getElementById('popular-filter').addEventListener('change', renderFilteredMenu);

    } catch (error) {
        container.innerHTML = '<p class="empty-cart" style="color:red;">Error connecting to the backend server.</p>';
        console.error("Error loading menu:", error);
    }
}

function renderFilteredMenu() {
    const container = document.getElementById('dynamic-menu-container');
    if (!container) return;

    // Get filter values
    const vegFilter = document.querySelector('input[name="veg-filter"]:checked').value;
    const priceFilter = document.getElementById('price-filter').value;
    const popularFilter = document.getElementById('popular-filter').checked;

    let filteredItems = allMenuItems;

    // Apply veg/non-veg filter
    if (vegFilter === 'veg') {
        filteredItems = filteredItems.filter(item => {
            const safeName = escapeHTML(item.name);
            return !safeName.toLowerCase().includes('chicken') && !safeName.toLowerCase().includes('egg');
        });
    }

    // Apply price filter
    if (priceFilter !== 'all') {
        const [min, max] = priceFilter.split('-');
        filteredItems = filteredItems.filter(item => {
            if (max) {
                return item.price >= Number(min) && item.price <= Number(max);
            } else { // For "250+"
                return item.price >= Number(min);
            }
        });
    }

    // Apply popular filter
    if (popularFilter) {
        filteredItems = filteredItems.filter(item => {
            const safeName = escapeHTML(item.name);
            return safeName.includes('Thali') || safeName.includes('Paneer') || safeName.includes('Biryani');
        });
    }
    
    // Group by category and render
    const groupedMenu = {};
    filteredItems.forEach(item => {
        const cat = item.category || "🍲 Main Course";
        if (!groupedMenu[cat]) groupedMenu[cat] = [];
        groupedMenu[cat].push(item);
    });

    let html = '';
    const order = ["🌟 Today's Special", "💰 Budget Meals", "🍱 Value Combos", "🍲 Main Course", "🥖 Breads & Parathas", "🍚 Rice & Biryani", "🥗 Extras & Desserts"];
    
    Object.keys(groupedMenu).forEach(cat => { if (!order.includes(cat)) order.push(cat); });

    order.forEach(cat => {
        if (groupedMenu[cat] && groupedMenu[cat].length > 0) {
            html += `<h2 class="menu-category-title">${cat}</h2>`;
            html += '<div class="menu-grid">';
            html += groupedMenu[cat].map(generateMenuItemHTML).join('');
            html += '</div>';
        }
    });

    container.innerHTML = html || '<p class="empty-cart" style="text-align: center; padding: 2rem;">No items match your filters.</p>';
}

function updateCartCount() {
    const cartCountEl = document.getElementById('cart-count');
    if(cartCountEl) {
        let cart = JSON.parse(localStorage.getItem('cart')) || [];
        cartCountEl.innerText = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    }
}

function renderCart() {
    const cartItemsContainer = document.getElementById('cart-items');
    const cartTotalEl = document.getElementById('cart-total-price');
    if(!cartItemsContainer) return;

    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    cartItemsContainer.innerHTML = '';
    
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-cart">Your cart is currently empty.</p>';
        cartTotalEl.innerText = '₹0';
        return;
    }

    let total = 0;
    cart.forEach((item, index) => {
        let qty = item.quantity || 1;
        total += item.price * qty;
        cartItemsContainer.innerHTML += `
            <div class="cart-item">
                <div style="flex: 1;"><strong>${escapeHTML(item.name)}</strong> <br><span style="font-size:0.85rem; color:#888;">₹${item.price} each</span></div>
                <div class="qty-controls">
                    <button class="qty-btn" onclick="updateQty(${index}, -1)">-</button>
                    <span style="font-weight: bold; width: 20px; text-align: center;">${qty}</span>
                    <button class="qty-btn" onclick="updateQty(${index}, 1)">+</button>
                </div>
                <div style="font-weight: bold; width: 70px; text-align: right;">₹${item.price * qty}</div>
            </div>
        `;
    });
    
    let deliveryMsg = '';
    let deliveryFee = 0;
    if (total > 0 && total < 199) {
        deliveryFee = 40;
        deliveryMsg = `<p style="color: #e74c3c; font-size: 0.95rem; text-align: right; margin-bottom: 10px;">Add ₹${199 - total} more for <strong>FREE delivery!</strong></p>`;
    } else if (total >= 199) {
        deliveryMsg = `<p style="color: #2ecc71; font-size: 0.95rem; text-align: right; font-weight: bold; margin-bottom: 10px;">🎉 You unlocked FREE delivery!</p>`;
    }

    cartTotalEl.innerHTML = `
        ${deliveryMsg}
        <div style="display:flex; justify-content: flex-end; gap: 2rem; font-size: 1.1rem; margin-top: 10px; color: #666;"><span>Subtotal:</span> <span>₹${total}</span></div>
        <div style="display:flex; justify-content: flex-end; gap: 2rem; font-size: 1.1rem; border-bottom: 1px solid #eee; padding-bottom: 10px; color: #666;"><span>Delivery Fee:</span> <span>₹${deliveryFee}</span></div>
        <div style="display:flex; justify-content: flex-end; gap: 2rem; margin-top: 15px; font-size: 1.4rem; color: #2c3e50;"><span>Grand Total:</span> <span>₹${total + deliveryFee}</span></div>
    `;
}

function updateQty(index, delta) {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    if (cart[index]) {
        cart[index].quantity = (cart[index].quantity || 1) + delta;
        if (cart[index].quantity <= 0) cart.splice(index, 1);
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    renderCart();
    if(typeof showStickyCart === 'function') showStickyCart();
}

function showCustomAlert(message, callback) {
    const overlay = document.createElement('div');
    overlay.id = 'custom-alert-page';
    
    const box = document.createElement('div');
    box.className = 'custom-alert-box';
    
    const msg = document.createElement('p');
    msg.innerText = message;
    
    const btn = document.createElement('button');
    btn.innerText = 'OK';
    btn.className = 'btn';
    btn.onclick = () => {
        document.body.removeChild(overlay);
        if (callback) callback();
    };
    
    box.appendChild(msg);
    box.appendChild(btn);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

function checkoutCart() {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    if (cart.length === 0) {
        showCustomAlert('Your cart is empty!');
        return;
    }
    window.location.href = 'payment.html';
}

function handleContactSubmit(event) {
    event.preventDefault();
    showCustomAlert('Message sent successfully!');
}

/* --- Admin Dashboard Functions --- */
function switchAdminTab(tabId) {
    document.querySelectorAll('.admin-tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.sidebar-nav a').forEach(nav => nav.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    document.getElementById('nav-' + tabId.replace('tab-', '')).classList.add('active');
    
    if(window.innerWidth <= 900) { document.getElementById('admin-sidebar').classList.remove('open'); }

    if (tabId === 'tab-dashboard') loadAdminDashboardStats();
    else if (tabId === 'tab-orders') loadAdminOrders();
    else if (tabId === 'tab-subscriptions') loadAdminSubscriptions();
    else if (tabId === 'tab-menu') loadAdminMenu();
    else if (tabId === 'tab-customers') loadAdminCustomers();
}

function toggleSidebar() {
    document.getElementById('admin-sidebar').classList.toggle('open');
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
}

async function loadAdminDashboardStats() {
    const container = document.getElementById('admin-dashboard-stats');
    if (!container) return;

    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/api/admin/dashboard-stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const { success, revenue, orderCounts, topItems } = await response.json();

        if (!success) {
            container.innerHTML = '<p style="color:red;">Could not load dashboard stats.</p>';
            return;
        }

        const orderCountsMap = orderCounts.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {});

        const totalOrders = orderCounts.reduce((sum, item) => sum + item.count, 0);

        let topItemsHtml = '<ul>';
        if (topItems.length > 0) {
            topItems.forEach(item => {
                topItemsHtml += `<li><span>${escapeHTML(item._id)}</span> <strong>${item.count} sold</strong></li>`;
            });
        } else {
            topItemsHtml += '<li>No item sales data yet.</li>';
        }
        topItemsHtml += '</ul>';

        container.innerHTML = `
            <div class="stat-card">
                <h3>Revenue (Completed)</h3>
                <p class="stat-value">₹${revenue.today.toLocaleString('en-IN')}</p>
                <p style="color: var(--admin-text-muted); font-size: 0.9rem;">Today</p>
                <hr style="margin: 10px 0; border-color: var(--admin-border);">
                <p style="font-size: 1rem;">This Week: <strong>₹${revenue.week.toLocaleString('en-IN')}</strong></p>
                <p style="font-size: 1rem;">This Month: <strong>₹${revenue.month.toLocaleString('en-IN')}</strong></p>
            </div>
            <div class="stat-card">
                <h3>Orders</h3>
                <p class="stat-value">${totalOrders}</p>
                <p style="color: var(--admin-text-muted); font-size: 0.9rem;">Total Orders</p>
                <ul style="font-size: 0.9rem;">
                    <li><span>Pending:</span> <strong>${orderCountsMap['Pending'] || 0}</strong></li>
                    <li><span>Preparing:</span> <strong>${orderCountsMap['Preparing'] || 0}</strong></li>
                    <li><span>Out for Delivery:</span> <strong>${orderCountsMap['Out for Delivery'] || 0}</strong></li>
                    <li><span>Completed:</span> <strong>${orderCountsMap['Completed'] || 0}</strong></li>
                    <li><span>Rejected:</span> <strong>${orderCountsMap['Rejected'] || 0}</strong></li>
                </ul>
            </div>
            <div class="stat-card">
                <h3>Top Selling Items</h3>
                ${topItemsHtml}
            </div>
        `;
    } catch (error) {
        container.innerHTML = '<p style="color:red;">Error connecting to server for stats.</p>';
    }
}

async function loadAdminOrders() {
    const container = document.getElementById('admin-orders-container');
    if (!container) return;

    const statusFilter = document.getElementById('status-filter')?.value;
    const paymentFilter = document.getElementById('payment-filter')?.value;
    const dateFilter = document.getElementById('date-filter')?.value;

    const params = new URLSearchParams();
    if (statusFilter) params.append('status', statusFilter);
    if (paymentFilter) params.append('paymentMethod', paymentFilter);
    if (dateFilter) params.append('date', dateFilter);

    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/api/orders?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.status === 401 || response.status === 403) {
            showCustomAlert('Session expired or unauthorized access.', () => window.location.href = 'login.html');
            return;
        }
        
        const orders = await response.json();
        
        if (!Array.isArray(orders) || orders.length === 0) {
            container.innerHTML = '<p class="empty-cart">No pending orders found.</p>';
            return;
        }

        const ordersHtml = orders.map(order => {
            const safeId = order._id || order.id || '00000';
            const status = order.status || 'Pending';
            const statusClass = status.toLowerCase().replace(/ /g, '-');
            const items = Array.isArray(order.items) ? order.items : [];
            const itemsList = items.map(i => `<li>${i.quantity || 1}x ${escapeHTML(i.name) || 'Item'}</li>`).join('');
            const displayAddress = escapeHTML(order.address || 'N/A').replace(/\n/g, ', ');
            const orderTimestamp = new Date(order.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

            let actionButtons = '';
            switch (status) {
                case 'Pending':
                    actionButtons = `
                        <button class="btn-order" style="padding: 6px 12px; background-color: #2ecc71;" onclick="updateOrderStatus('${safeId}', 'Preparing')">Accept</button>
                        <button class="btn-order" style="padding: 6px 12px; background-color: #e74c3c;" onclick="updateOrderStatus('${safeId}', 'Rejected')">Reject</button>
                    `;
                    break;
                case 'Preparing':
                    actionButtons = `<button class="btn-order" style="padding: 6px 12px; background-color: #3498db;" onclick="updateOrderStatus('${safeId}', 'Out for Delivery')">Dispatch</button>`;
                    break;
                case 'Out for Delivery':
                    actionButtons = `<button class="btn-order" style="padding: 6px 12px;" onclick="updateOrderStatus('${safeId}', 'Completed')">Delivered</button>`;
                    break;
                case 'Completed':
                    actionButtons = `<button class="btn-order" style="padding: 6px 12px; background-color: #7f8c8d;" onclick="deleteOrder('${safeId}')">Archive</button>`;
                    break;
                case 'Rejected':
                    actionButtons = `<button class="btn-order" style="padding: 6px 12px; background-color: #7f8c8d;" onclick="deleteOrder('${safeId}')">Archive</button>`;
                    break;
            }

            return `
                <div class="order-card">
                    <div class="order-header">
                        <h3>Order #${escapeHTML(safeId.toString().slice(-5))}</h3>
                        <span class="status ${statusClass}">${escapeHTML(status)}</span>
                    </div>
                    <p><strong>Customer:</strong> ${escapeHTML(order.customerName) || 'Guest'}</p>
                    <p><strong>Contact:</strong> <a href="tel:${escapeHTML(order.contact || '')}">${escapeHTML(order.contact || 'N/A')}</a></p>
                    <p><strong>Payment:</strong> ${escapeHTML(order.paymentMethod || 'Online')}</p>
                    <p><strong>Address:</strong> <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address || '')}" target="_blank" style="color: #e67e22; text-decoration: none; font-weight: bold;" title="Click to navigate on Google Maps">${displayAddress} 📍 Navigate</a></p>
                    <p><strong>Time:</strong> ${orderTimestamp || 'N/A'}</p>
                    ${order.rating ? `<p style="color: #f39c12; margin: 0.5rem 0;"><strong>Rating:</strong> ${'★'.repeat(order.rating)}${'☆'.repeat(5 - order.rating)} <br><span style="color: #555; font-size: 0.9rem; font-style: italic;">"${escapeHTML(order.review || '')}"</span></p>` : ''}
                    <ul class="order-items-list">${itemsList}</ul>
                    <div class="order-footer">
                        <strong>Total: ₹${Number(order.total) || 0}</strong>
                        <div class="order-actions">
                            ${actionButtons}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = ordersHtml;
    } catch (error) {
        container.innerHTML = '<p class="empty-cart" style="color:red;">Error connecting to the backend server.</p>';
    }
}

async function loadAdminSubscriptions() {
    const container = document.getElementById('admin-subscriptions-container');
    if (!container) return;

    const statusFilter = document.getElementById('sub-status-filter')?.value;
    let url = `${API_BASE_URL}/api/admin/subscriptions`;
    if (statusFilter) url += `?status=${statusFilter}`;

    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (!data.success || !data.subscriptions || data.subscriptions.length === 0) {
            container.innerHTML = '<p class="empty-cart">No subscriptions found.</p>';
            return;
        }

        container.innerHTML = data.subscriptions.map(sub => {
            const statusClass = sub.status === 'Active' ? 'completed' : (sub.status === 'Cancelled' ? 'rejected' : 'pending');
            const displayAddress = escapeHTML(sub.address || 'N/A').replace(/\n/g, ', ');
            const startDate = new Date(sub.startDate).toLocaleDateString('en-IN', { dateStyle: 'medium' });
            const freqText = sub.frequency === 7 && sub.plan.includes('Trial') ? '7-Day Trial' : `${sub.frequency} Days/Week`;
            
            let actions = '';
            if (sub.status === 'Pending') {
                actions = `
                    <button class="btn-order" style="padding: 6px 12px; background-color: #2ecc71;" onclick="updateSubscriptionStatus('${sub._id}', 'Active')">Mark Active</button>
                    <button class="btn-order" style="padding: 6px 12px; background-color: #e74c3c;" onclick="updateSubscriptionStatus('${sub._id}', 'Cancelled')">Cancel</button>
                `;
            } else if (sub.status === 'Active') {
                actions = `<button class="btn-order" style="padding: 6px 12px; background-color: #e74c3c;" onclick="updateSubscriptionStatus('${sub._id}', 'Cancelled')">Cancel Sub</button>`;
            }

            return `
                <div class="order-card">
                    <div class="order-header">
                        <h3 style="color: #2c3e50;">${escapeHTML(sub.plan)}</h3>
                        <span class="status ${statusClass}">${escapeHTML(sub.status)}</span>
                    </div>
                    <p><strong>Customer:</strong> ${escapeHTML(sub.customerName)}</p>
                    <p><strong>Contact:</strong> <a href="tel:${escapeHTML(sub.contact)}">${escapeHTML(sub.contact)}</a></p>
                    <p><strong>Address:</strong> <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(sub.address || '')}" target="_blank" style="color: #e67e22; text-decoration: none; font-weight: bold;">${displayAddress} 📍</a></p>
                    <div style="background: var(--admin-bg); padding: 10px; border-radius: 5px; margin: 10px 0;">
                        <p style="margin: 0; font-size: 0.9rem;"><strong>Plan Details:</strong> ${freqText} &bull; ${sub.persons === 2 ? '2 People' : '1 Person'}</p>
                        ${sub.couponCode ? `<p style="margin: 0; font-size: 0.9rem;"><strong>Coupon:</strong> <span style="color: #27ae60; font-weight: bold;">${escapeHTML(sub.couponCode)}</span></p>` : ''}
                        <p style="margin: 0; font-size: 0.9rem;"><strong>Start Date:</strong> <span style="color: #27ae60; font-weight: bold;">${startDate}</span></p>
                    </div>
                    <div class="order-footer">
                        <strong style="color: #e67e22; font-size: 1.1rem;">₹${sub.price}</strong>
                        <div class="order-actions">${actions}</div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        container.innerHTML = '<p class="empty-cart" style="color:red;">Error fetching subscriptions.</p>';
    }
}

async function updateSubscriptionStatus(id, status) {
    const token = localStorage.getItem('authToken');
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/subscriptions/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ status })
        });
        const data = await response.json();
        
        if (data.success && status === 'Active' && data.sub) {
            const sub = data.sub;
            const startDate = new Date(sub.startDate).toLocaleDateString('en-IN', { dateStyle: 'medium' });
            const message = `Hi ${sub.customerName}, your Kajal Ki Rasoi ${sub.plan} subscription is now ACTIVE! 🎉 Deliveries start from ${startDate}.`;
            const cleanContact = (sub.contact || '').replace(/\D/g, '');
            const waPhone = cleanContact.length === 10 ? '91' + cleanContact : cleanContact;
            const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;
            
            showCustomAlert('Subscription activated! Click OK to notify the customer on WhatsApp.', () => {
                window.open(waUrl, '_blank');
                loadAdminSubscriptions();
            });
        } else {
            loadAdminSubscriptions();
        }
    } catch (error) { showCustomAlert('Failed to update subscription status.'); }
}

async function loadAdminCustomers() {
    const container = document.getElementById('admin-customers-container');
    if (!container) return;

    try {
        const token = localStorage.getItem('authToken');
        const res = await fetch(`${API_BASE_URL}/api/admin/customers`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();

        if (!data.success || data.customers.length === 0) {
            container.innerHTML = '<p class="empty-cart">No customer data available yet.</p>';
            return;
        }

        let html = '<div style="overflow-x: auto;"><table style="width:100%; border-collapse: collapse; background: var(--admin-card-bg); box-shadow: 0 4px 10px rgba(0,0,0,0.05); border-radius: 5px; overflow: hidden; min-width: 600px;">';
        html += '<tr style="background: var(--admin-sidebar); color: var(--admin-sidebar-text); text-align: left;"><th style="padding: 1rem;">Name</th><th style="padding: 1rem;">Contact</th><th style="padding: 1rem;">Total Orders</th><th style="padding: 1rem;">Total Spent</th><th style="padding: 1rem;">Last Order</th><th style="padding: 1rem;">Actions</th></tr>';
        
        data.customers.forEach(cust => {
            const isRepeat = cust.orderCount > 1;
            html += `
                <tr style="border-bottom: 1px solid var(--admin-border);">
                    <td style="padding: 1rem;">${escapeHTML(cust.name || 'Guest')} ${isRepeat ? '⭐' : ''}</td>
                    <td style="padding: 1rem;">${escapeHTML(cust._id)}</td>
                    <td style="padding: 1rem;"><span style="background: #3498db; color: #fff; padding: 3px 8px; border-radius: 12px; font-size: 0.85rem;">${cust.orderCount}</span></td>
                    <td style="padding: 1rem; font-weight: bold; color: #27ae60;">₹${cust.totalSpent.toLocaleString('en-IN')}</td>
                    <td style="padding: 1rem; color: var(--admin-text-muted); font-size: 0.9rem;">${new Date(cust.lastOrderDate).toLocaleDateString()}</td>
                    <td style="padding: 1rem;">
                        <button class="btn-order" style="padding: 5px 12px; background: #e67e22;" onclick="viewCustomerHistory('${escapeHTML(cust._id)}', '${escapeHTML(cust.name || 'Guest')}')">View History</button>
                    </td>
                </tr>
            `;
        });
        html += '</table></div>';
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = '<p style="color:red;">Error loading customers.</p>';
    }
}

async function viewCustomerHistory(contact, name) {
    const token = localStorage.getItem('authToken');
    try {
        const res = await fetch(`${API_BASE_URL}/api/orders?contact=${encodeURIComponent(contact)}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const orders = await res.json();

        const overlay = document.createElement('div');
        overlay.id = 'custom-alert-page';
        const modalContent = document.createElement('div');
        modalContent.className = 'custom-alert-box';
        modalContent.style.maxWidth = '600px';
        modalContent.style.textAlign = 'left';

        let html = `<h3 style="margin-bottom: 1rem; color: var(--admin-text-main);">Order History: ${name}</h3>`;
        html += `<p style="margin-bottom: 1rem; color: var(--admin-text-muted);">Contact: ${contact}</p>`;
        html += `<div style="max-height: 50vh; overflow-y: auto; padding-right: 10px;">`;
        
        orders.forEach(order => {
            const itemsList = order.items.map(i => `${i.quantity || 1}x ${escapeHTML(i.name)}`).join(', ');
            html += `
                <div style="border: 1px solid var(--admin-border); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; background: var(--admin-bg);">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <strong>Order #${order._id.slice(-5)}</strong>
                        <span class="status ${order.status.toLowerCase().replace(/ /g, '-')}">${order.status}</span>
                    </div>
                    <p style="font-size: 0.9rem; margin-bottom: 5px;">${new Date(order.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    <p style="font-size: 0.9rem; color: var(--admin-text-muted); margin-bottom: 5px;">Items: ${itemsList}</p>
                    <p style="font-size: 1rem; font-weight: bold; text-align: right;">Total: ₹${order.total}</p>
                </div>
            `;
        });

        html += `</div><button class="btn" style="width: 100%; margin-top: 1rem;" onclick="document.body.removeChild(this.closest('#custom-alert-page'))">Close</button>`;
        
        modalContent.innerHTML = html;
        overlay.appendChild(modalContent);
        document.body.appendChild(overlay);
    } catch (error) {
        showCustomAlert('Error fetching customer history.');
    }
}

async function loadMyOrders() {
    const container = document.getElementById('my-orders-container');
    const activeContainer = document.getElementById('active-order-container');
    if (!container) return;

    const statusFilter = document.getElementById('past-status-filter')?.value || 'all';

    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/api/my-orders`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.status === 401 || response.status === 403) {
            showCustomAlert('Session expired. Please log in again.', () => window.location.href = 'login.html');
            return;
        }
        
        const orders = await response.json();
        
        if (!Array.isArray(orders) || orders.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem 1rem;">
                    <h3 style="color: var(--admin-text-main); margin-bottom: 1rem;">No orders yet!</h3>
                    <p style="color: var(--admin-text-muted); margin-bottom: 2rem;">Your future and past orders will appear here.</p>
                    <a href="index.html#menu" class="btn">Start Ordering</a>
                </div>
            `;
            if(activeContainer) activeContainer.innerHTML = '';
            return;
        }

        const activeOrders = orders.filter(o => ['Pending', 'Preparing', 'Out for Delivery'].includes(o.status));
        const pastOrders = orders.filter(o => !['Pending', 'Preparing', 'Out for Delivery'].includes(o.status));

        if (activeContainer) {
            if (activeOrders.length > 0) {
                activeContainer.innerHTML = generateActiveOrderHTML(activeOrders[0]);
            } else {
                activeContainer.innerHTML = '';
            }
        }

        let filteredPastOrders = pastOrders;
        if (statusFilter !== 'all') {
            filteredPastOrders = pastOrders.filter(o => statusFilter === 'Completed' ? o.status === 'Completed' : (o.status === 'Rejected' || o.status === 'Cancelled'));
        }

        if (filteredPastOrders.length === 0) {
            container.innerHTML = '<p class="empty-cart">No past orders match this filter.</p>';
        } else {
            container.innerHTML = filteredPastOrders.map(order => generatePastOrderHTML(order)).join('');
        }
    } catch (error) {
        container.innerHTML = '<p class="empty-cart" style="color:red;">Error fetching your orders.</p>';
    }
}

function generateActiveOrderHTML(order) {
    const statuses = ['Pending', 'Preparing', 'Out for Delivery', 'Completed'];
    const currentIndex = statuses.indexOf(order.status);
    const fillPercentage = currentIndex > 0 ? (currentIndex / (statuses.length - 1)) * 100 : 0;
    
    const safeId = order._id || order.id || '00000';
    const itemsList = order.items.map(i => `${i.quantity || 1}x ${escapeHTML(i.name)}`).join(', ');

    let eta = "35 mins";
    if (order.status === 'Preparing') eta = "20 mins";
    if (order.status === 'Out for Delivery') eta = "10 mins";

    return `
        <div class="active-order-card">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap;">
                <div>
                    <p style="font-size: 0.9rem; color: var(--admin-text-muted); margin-bottom: 0;">Estimated Delivery</p>
                    <p style="font-size: 2.2rem; font-weight: bold; color: #2ecc71; margin-top: 0; line-height: 1;">${eta}</p>
                </div>
                <div class="hygiene-badge">✨ Max Safety & Hygiene</div>
            </div>

            <div class="progress-track">
                <div class="progress-fill" style="width: ${fillPercentage}%"></div>
                ${statuses.map((status, index) => {
                    let stepClass = 'progress-step';
                    let icon = '';
                    if (index < currentIndex) { stepClass += ' completed'; icon = '✓'; } 
                    else if (index === currentIndex) { stepClass += ' active'; icon = '🍲'; }
                    return `<div class="${stepClass}">${icon}<span class="step-label">${status}</span></div>`;
                }).join('')}
            </div>

            <div style="margin-top: 3.5rem; background: var(--admin-bg); padding: 1rem; border-radius: 10px;">
                <div style="display: flex; justify-content: space-between;">
                    <p><strong>Order #${safeId.toString().slice(-5)}</strong></p>
                    <button class="btn-edit-profile" style="position: static;" onclick="viewReceipt('${safeId}')">Details</button>
                </div>
                <p style="color: var(--admin-text-muted); font-size: 0.9rem; margin-bottom: 5px;">${itemsList}</p>
                <p style="font-weight: bold; font-size: 1.1rem; color: var(--admin-text-main);">Total: ₹${order.total} <span style="font-size: 0.8rem; font-weight: normal; color: var(--admin-text-muted); background: var(--admin-border); padding: 2px 6px; border-radius: 4px;">${order.paymentMethod}</span></p>
            </div>

            <div class="order-actions-row">
                ${order.status === 'Pending' ? `<button class="btn-outline" style="color: #e74c3c; border-color: #e74c3c;" onclick="cancelOrder('${safeId}')">Cancel Order</button>` : ''}
                <button class="btn-outline" onclick="showCustomAlert('Please call us at: +91 7366952957')">📞 Call Support</button>
                ${order.status === 'Out for Delivery' ? `<button class="btn" style="padding: 8px 20px;" onclick="trackDelivery('${safeId}')">📍 Track Map</button>` : ''}
            </div>
        </div>
    `;
}

function generatePastOrderHTML(order) {
    const safeId = order._id || order.id || '00000';
    const status = order.status || 'Pending';
    const statusClass = status.toLowerCase().replace(/ /g, '-');
    const isDelivered = status === 'Completed';
    const items = Array.isArray(order.items) ? order.items : [];
    const itemsSummary = items.map(i => `${i.quantity || 1}x ${escapeHTML(i.name)}`).join(', ');

    return `
        <div class="order-card" style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div style="flex: 1; min-width: 200px;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="background: var(--admin-bg); padding: 1rem; border-radius: 10px; font-size: 1.5rem;">🍲</div>
                    <div>
                        <h4 style="margin: 0; color: var(--admin-text-main);">Kajal Ki Rasoi</h4>
                        <p style="margin: 0; font-size: 0.8rem; color: var(--admin-text-muted);">${new Date(order.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                        <p style="margin: 0.2rem 0 0 0; font-weight: bold; color: var(--admin-text-main);">₹${order.total} &bull; <span class="status ${statusClass}" style="font-size: 0.75rem;">${status}</span></p>
                    </div>
                </div>
                <p style="margin: 0.8rem 0 0 0; font-size: 0.9rem; color: var(--admin-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 300px;">${itemsSummary}</p>
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.5rem; text-align: right;">
                ${isDelivered ? `<button class="btn" style="padding: 8px 15px;" onclick='reorderItems(${JSON.stringify(items).replace(/'/g, "&#39;")})'>🔁 Reorder</button>` : ''}
                <button class="btn-outline" style="padding: 6px 12px; font-size: 0.85rem;" onclick="viewReceipt('${safeId}')">View Details</button>
                ${isDelivered && !order.rating ? `<button class="btn-outline" style="padding: 6px 12px; font-size: 0.85rem; color: #f39c12; border-color: #f39c12;" onclick="showRatingModal('${safeId}')">⭐ Rate</button>` : ''}
            </div>
        </div>
    `;
}

/* --- Admin Menu Management --- */
async function loadAdminMenu() {
    const container = document.getElementById('admin-menu-container');
    if (!container) return; // Fail silently if the element isn't in the HTML yet

    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/api/admin/menu`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.status === 401 || response.status === 403) {
            showCustomAlert('Session expired. Please log in again.', () => window.location.href = 'login.html');
            return;
        }
        
        const menuItems = await response.json();
        
        let html = '<button class="btn" style="margin-bottom: 1rem;" onclick="showMenuModal()">+ Add New Menu Item</button>';
        
        if (!Array.isArray(menuItems) || menuItems.length === 0) {
            html += '<p class="empty-cart">No menu items found.</p>';
        } else {
            html += '<div style="overflow-x: auto;"><table style="width:100%; border-collapse: collapse; background: var(--admin-card-bg); box-shadow: 0 4px 10px rgba(0,0,0,0.05); border-radius: 5px; overflow: hidden; min-width: 600px;">';
            html += '<tr style="background: var(--admin-sidebar); color: var(--admin-sidebar-text); text-align: left;"><th style="padding: 1rem;">Image</th><th style="padding: 1rem;">Name</th><th style="padding: 1rem;">Price</th><th style="padding: 1rem;">Status</th><th style="padding: 1rem;">Actions</th></tr>';
            
            menuItems.forEach(item => {
                const isAvailable = item.available !== false;
                const imageSrc = item.imageUrl && item.imageUrl.trim() !== '' ? escapeHTML(item.imageUrl) : getDefaultImage(item.name);
                html += `
                    <tr style="border-bottom: 1px solid var(--admin-border);">
                        <td style="padding: 1rem;"><img src="${imageSrc}" loading="lazy" decoding="async" alt="${escapeHTML(item.name)}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 5px; border: 1px solid #ddd;" onerror="this.src='https://via.placeholder.com/50?text=Error'"></td>
                        <td style="padding: 1rem;">${escapeHTML(item.name)}</td>
                        <td style="padding: 1rem;">₹${item.price}</td>
                        <td style="padding: 1rem;"><span class="status ${isAvailable ? 'completed' : 'preparing'}">${isAvailable ? 'Available' : 'Sold Out'}</span></td>
                        <td style="padding: 1rem;">
                            <button class="btn-order" style="padding: 4px 10px; background-color: ${isAvailable ? '#f39c12' : '#2ecc71'}; margin-right: 5px;" onclick="toggleMenuItemAvailability('${item._id}', ${isAvailable})">${isAvailable ? 'Mark Sold Out' : 'Mark Available'}</button>
                            <button class="btn-order" style="padding: 4px 10px; background-color: #3498db; margin-right: 5px;" onclick='showMenuModal(${JSON.stringify(item).replace(/'/g, "&#39;")})'>Edit</button>
                            <button class="btn-order" style="padding: 4px 10px; background-color: #e74c3c;" onclick="deleteMenuItem('${item._id}')">Delete</button>
                        </td>
                    </tr>
                `;
            });
            html += '</table></div>';
        }
        
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = '<p style="color:red;">Error fetching menu items.</p>';
    }
}

function updateModalPreview() {
    const imgUrl = document.getElementById('menu-image').value.trim();
    const itemName = document.getElementById('menu-name').value.trim();
    const preview = document.getElementById('img-preview');
    if (imgUrl) {
        preview.src = imgUrl;
    } else {
        preview.src = getDefaultImage(itemName);
    }
}

function showMenuModal(item = null) {
    const overlay = document.createElement('div');
    overlay.id = 'custom-alert-page';
    const content = document.createElement('div');
    content.className = 'custom-alert-box';
    content.style.textAlign = 'left';
    
    const isEdit = !!item;
    const defaultPreview = isEdit ? (item.imageUrl && item.imageUrl.trim() !== '' ? escapeHTML(item.imageUrl) : getDefaultImage(item.name)) : getDefaultImage('');
    content.innerHTML = `
        <h3 style="margin-bottom: 1rem; color: var(--admin-text-main); text-align: center;">${isEdit ? 'Edit Menu Item' : 'Add New Item'}</h3>
        <form id="menu-form" style="display: flex; flex-direction: column; gap: 1rem;">
            <input type="hidden" id="menu-id" value="${isEdit ? item._id : ''}">
            <div>
                <label style="font-weight: bold; display: block; margin-bottom: 0.3rem; color: var(--admin-text-main);">Name</label>
                <input type="text" id="menu-name" value="${isEdit ? escapeHTML(item.name) : ''}" required style="width: 100%; padding: 8px; border: 1px solid var(--admin-border); border-radius: 4px; background: var(--admin-bg); color: var(--admin-text-main);" oninput="updateModalPreview()">
            </div>
            <div>
                <label style="font-weight: bold; display: block; margin-bottom: 0.3rem; color: var(--admin-text-main);">Price (₹)</label>
                <input type="number" id="menu-price" value="${isEdit ? item.price : ''}" required style="width: 100%; padding: 8px; border: 1px solid var(--admin-border); border-radius: 4px; background: var(--admin-bg); color: var(--admin-text-main);">
            </div>
            <div>
                <label style="font-weight: bold; display: block; margin-bottom: 0.3rem; color: var(--admin-text-main);">Description</label>
                <textarea id="menu-desc" style="width: 100%; padding: 8px; border: 1px solid var(--admin-border); border-radius: 4px; min-height: 60px; background: var(--admin-bg); color: var(--admin-text-main);">${isEdit && item.description ? escapeHTML(item.description) : ''}</textarea>
            </div>
            <div>
                <label style="font-weight: bold; display: block; margin-bottom: 0.3rem; color: var(--admin-text-main);">Image (Link or Upload)</label>
                <input type="text" id="menu-image" value="${isEdit && item.imageUrl ? escapeHTML(item.imageUrl) : ''}" placeholder="Paste an image link..." style="width: 100%; padding: 8px; border: 1px solid var(--admin-border); border-radius: 4px; margin-bottom: 0.5rem; background: var(--admin-bg); color: var(--admin-text-main);" oninput="updateModalPreview()">
                <div style="text-align: center; margin-bottom: 0.5rem; font-size: 0.9rem; color: var(--admin-text-muted);">- OR -</div>
                <input type="file" id="menu-image-file" accept="image/*" style="width: 100%; padding: 8px; border: 1px solid var(--admin-border); border-radius: 4px; background: var(--admin-bg); color: var(--admin-text-main);">
                <div style="margin-top: 10px; text-align: center;">
                    <img id="img-preview" src="${defaultPreview}" style="max-width: 100%; height: 120px; border-radius: 8px; object-fit: cover; border: 1px solid var(--admin-border);" alt="Image Preview" onerror="this.src='https://via.placeholder.com/150?text=Invalid+Image'">
                </div>
            </div>
            <div>
                <label style="font-weight: bold; display: block; margin-bottom: 0.3rem; color: var(--admin-text-main);">Category</label>
                <select id="menu-category" style="width: 100%; padding: 8px; border: 1px solid var(--admin-border); border-radius: 4px; background: var(--admin-bg); color: var(--admin-text-main);">
                    <option value="🌟 Today's Special" ${isEdit && item.category === "🌟 Today's Special" ? 'selected' : ''}>🌟 Today's Special</option>
                    <option value="💰 Budget Meals" ${isEdit && item.category === "💰 Budget Meals" ? 'selected' : ''}>💰 Budget Meals</option>
                    <option value="🍱 Value Combos" ${isEdit && item.category === "🍱 Value Combos" ? 'selected' : ''}>🍱 Value Combos</option>
                    <option value="🍲 Main Course" ${(!isEdit || item.category === "🍲 Main Course") ? 'selected' : ''}>🍲 Main Course</option>
                    <option value="🥖 Breads & Parathas" ${isEdit && item.category === "🥖 Breads & Parathas" ? 'selected' : ''}>🥖 Breads & Parathas</option>
                    <option value="🍚 Rice & Biryani" ${isEdit && item.category === "🍚 Rice & Biryani" ? 'selected' : ''}>🍚 Rice & Biryani</option>
                    <option value="🥗 Extras & Desserts" ${isEdit && item.category === "🥗 Extras & Desserts" ? 'selected' : ''}>🥗 Extras & Desserts</option>
                </select>
            </div>
            <div>
                <label style="font-weight: bold; display: flex; align-items: center; gap: 0.5rem; cursor: pointer; color: var(--admin-text-main);">
                    <input type="checkbox" id="menu-available" ${!isEdit || item.available !== false ? 'checked' : ''}>
                    Available (In Stock)
                </label>
            </div>
            <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                <button type="submit" class="btn" style="flex: 1;">Save</button>
                <button type="button" class="btn" style="flex: 1; background-color: #95a5a6;" onclick="document.body.removeChild(this.closest('#custom-alert-page'))">Cancel</button>
            </div>
        </form>
    `;
    
    overlay.appendChild(content);
    document.body.appendChild(overlay);
    
    document.getElementById('menu-image-file').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                const img = new Image();
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800;
                    const MAX_HEIGHT = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > height && width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    } else if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Compress to JPEG with 80% quality to save space
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    
                    document.getElementById('menu-image').value = dataUrl;
                    updateModalPreview();
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('menu-form').onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('menu-id').value;
        const payload = {
            name: document.getElementById('menu-name').value,
            price: Number(document.getElementById('menu-price').value),
            description: document.getElementById('menu-desc').value,
            category: document.getElementById('menu-category').value,
            imageUrl: document.getElementById('menu-image').value,
            available: document.getElementById('menu-available').checked
        };
        
        const token = localStorage.getItem('authToken');
        const url = id ? `${API_BASE_URL}/api/menu/${id}` : `${API_BASE_URL}/api/menu`;
        const method = id ? 'PUT' : 'POST';
        
        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            
            if (res.ok) {
                document.body.removeChild(overlay);
                showCustomAlert(id ? 'Item updated successfully.' : 'Item added successfully.', loadAdminMenu);
            } else {
                const data = await res.json();
                showCustomAlert(data.message || 'Failed to save item.');
            }
        } catch (error) {
            showCustomAlert('Error connecting to server.');
        }
    };
}

async function deleteMenuItem(id) {
    if (!confirm('Are you sure you want to delete this menu item permanently?')) return;
    
    const token = localStorage.getItem('authToken');
    try {
        const res = await fetch(`${API_BASE_URL}/api/menu/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            showCustomAlert('Menu item deleted.', loadAdminMenu);
        } else {
            const data = await res.json();
            showCustomAlert(data.message || 'Failed to delete item.');
        }
    } catch (error) {
        showCustomAlert('Error connecting to server.');
    }
}

async function toggleMenuItemAvailability(id, currentStatus) {
    const token = localStorage.getItem('authToken');
    try {
        const res = await fetch(`${API_BASE_URL}/api/menu/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ available: !currentStatus })
        });
        
        if (res.ok) {
            loadAdminMenu();
        } else {
            const data = await res.json();
            showCustomAlert(data.message || 'Failed to update availability.');
        }
    } catch (error) {
        showCustomAlert('Error connecting to server.');
    }
}

async function updateOrderStatus(orderId, status) {
    const token = localStorage.getItem('authToken');
    try {
        const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ status })
        });

        if (!response.ok) {
            const data = await response.json();
            showCustomAlert(data.message || 'Failed to update order status.');
        }
        // The WebSocket listener will automatically call loadAdminOrders() on success.
    } catch (error) {
        showCustomAlert('Error communicating with the server.');
    }
}

async function deleteOrder(orderId) {
    if (!confirm('Are you sure you want to delete this order permanently?')) {
        return;
    }
    const token = localStorage.getItem('authToken');
    try {
        const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            showCustomAlert('Failed to delete order.');
        }
    } catch (error) {
        showCustomAlert('Error communicating with the server.');
    }
}

async function cancelOrder(orderId) {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    
    const token = localStorage.getItem('authToken');
    try {
        const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}/cancel`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
            showCustomAlert('Order cancelled successfully.', () => loadMyOrders());
        } else {
            showCustomAlert(data.message || 'Failed to cancel order.');
        }
    } catch (error) {
        showCustomAlert('Error communicating with the server.');
    }
}

function reorderItems(items) {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    items.forEach(pastItem => {
        let existing = cart.find(i => i.name === pastItem.name);
        if (existing) { existing.quantity = (existing.quantity || 1) + (pastItem.quantity || 1); } 
        else { cart.push({ name: pastItem.name, price: pastItem.price, quantity: pastItem.quantity || 1 }); }
    });
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    showCustomAlert('Items added to cart!', () => window.location.href = 'cart.html');
}

function trackDelivery(orderId, hasRated = false) {
    // Dynamically inject Map library if it hasn't been loaded yet
    if (typeof L === 'undefined') {
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(css);

        const js = document.createElement('script');
        js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        js.onload = () => openMapModal(orderId, hasRated);
        document.head.appendChild(js);
        return;
    }
    
    openMapModal(orderId, hasRated);
}

function openMapModal(orderId, hasRated) {
    const overlay = document.createElement('div');
    overlay.id = 'map-modal';
    
    const mapContainer = document.createElement('div');
    mapContainer.id = 'map-container';
    
    const mapDiv = document.createElement('div');
    mapDiv.id = 'delivery-map';
    mapDiv.style.width = '100%';
    mapDiv.style.height = '100%';
    mapDiv.style.borderRadius = '8px';
    
    let animationInterval;
    const closeBtn = document.createElement('button');
    closeBtn.innerText = 'Close Map';
    closeBtn.className = 'close-map';
    closeBtn.onclick = () => {
        if (animationInterval) clearInterval(animationInterval);
        document.body.removeChild(overlay);
    };
    
    mapContainer.appendChild(closeBtn);
    mapContainer.appendChild(mapDiv);
    overlay.appendChild(mapContainer);
    document.body.appendChild(overlay);

    // Initialize Leaflet Map (Using a free open-source map provider)
    const map = L.map('delivery-map').setView([28.6139, 77.2090], 13); // Centered on a sample city (Delhi coordinates)
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const startLat = 28.6139, startLng = 77.2090;
    const endLat = 28.6239, endLng = 77.2190;

    // Mock Restaurant Marker
    const restaurantMarker = L.marker([startLat, startLng]).addTo(map)
        .bindPopup('<b>Kajal Ki Rasoi</b>').openPopup();

    // Mock Delivery Marker (starts at restaurant)
    const deliveryMarker = L.marker([startLat, startLng]).addTo(map)
        .bindPopup('<b>Delivery Partner</b><br>Arriving soon!');

    // Draw route line
    const route = L.polyline([[startLat, startLng], [endLat, endLng]], {color: '#e67e22', weight: 4}).addTo(map);
    map.fitBounds(route.getBounds(), { padding: [50, 50] });

    // Animate marker along the route
    let progress = 0;
    const totalFrames = 150; // 150 frames total
    const latStep = (endLat - startLat) / totalFrames;
    const lngStep = (endLng - startLng) / totalFrames;

    animationInterval = setInterval(() => {
        progress++;
        deliveryMarker.setLatLng([startLat + (latStep * progress), startLng + (lngStep * progress)]);
        
        if (progress >= totalFrames) {
            clearInterval(animationInterval);
            deliveryMarker.bindPopup('<b>Delivery Partner</b><br>Arrived!').openPopup();
            if (!hasRated) {
                setTimeout(() => showRatingModal(orderId), 2000); // Show rating after 2 seconds
            }
        }
    }, 50); // 50ms per frame = 7.5 seconds animation duration
}

/* --- Stripe Payment Functions --- */
let stripePublishableKey;

async function initializePaymentPage() {
    // Dynamically inject Stripe library if it hasn't been loaded yet
    if (typeof Stripe === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://js.stripe.com/v3/';
        document.head.appendChild(script);
    }

    try {
        const configRes = await fetch(`${API_BASE_URL}/api/config/stripe`);
        const data = await configRes.json();
        stripePublishableKey = data.publishableKey;
    } catch (error) {
        console.error('Failed to load Stripe configuration.');
        document.getElementById('payment-message').textContent = 'Payment system temporarily unavailable.';
        return;
    }

    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    if (cart.length === 0) {
        window.location.href = 'cart.html';
        return;
    }

    // Display total amount dynamically on the UI
    let total = 0;
    cart.forEach(item => total += item.price);
    const summaryEl = document.getElementById('checkout-summary');
    if (summaryEl) {
        summaryEl.innerHTML = `<strong>${cart.length} Item(s) in Cart</strong><br><span style="color: #e67e22; font-size: 1.5rem; font-weight: bold; display: inline-block; margin-top: 5px;">Total: ₹${total}</span>`;
    }
    const payBtn = document.getElementById('submit-payment-btn');
    if (payBtn) {
        payBtn.innerText = `Pay ₹${total} Securely`;
    }

    const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
    const customerName = loggedInUser ? loggedInUser.name : 'Customer';
    const customerContact = loggedInUser ? loggedInUser.contact : '';

    const nameInput = document.getElementById('card-name');
    if (nameInput) nameInput.value = customerName;

    // Auto-fill the last used address for this user to save time
    try {
        if (customerContact) {
            const savedAddr = JSON.parse(localStorage.getItem(`savedDeliveryAddress_${customerContact}`));
            if (savedAddr) {
                if (document.getElementById('address-flat')) document.getElementById('address-flat').value = savedAddr.flat || '';
                if (document.getElementById('address-area')) document.getElementById('address-area').value = savedAddr.area || '';
                if (document.getElementById('address-landmark')) document.getElementById('address-landmark').value = savedAddr.landmark || '';
                if (document.getElementById('address-city')) document.getElementById('address-city').value = savedAddr.city || '';
                if (document.getElementById('address-pincode')) document.getElementById('address-pincode').value = savedAddr.pincode || '';
            }
        }
    } catch (e) {
        console.error('Could not load saved address', e);
    }

    // --- Trust Check for COD ---
    const token = localStorage.getItem('authToken');
    const codRadio = document.querySelector('input[value="cod"]');
    if (codRadio) {
        if (!token) {
            codRadio.disabled = true;
            const span = document.createElement('span');
            span.style.cssText = "font-size: 0.8rem; color: #e74c3c; margin-left: 5px;";
            span.innerText = "(Login required)";
            if (codRadio.parentElement) {
                codRadio.parentElement.style.opacity = '0.6';
                codRadio.parentElement.appendChild(span);
            }
        } else {
            fetch(`${API_BASE_URL}/api/profile`, { headers: { 'Authorization': `Bearer ${token}` } })
                .then(r => r.json())
                .then(data => {
                    if (data.success && !data.user.isTrusted) {
                        const currentCodRadio = document.querySelector('input[value="cod"]');
                        if (currentCodRadio) {
                            currentCodRadio.disabled = true;
                            const onlineRadio = document.querySelector('input[value="online"]');
                            if (onlineRadio && currentCodRadio.checked) {
                                onlineRadio.checked = true;
                            }
                            const span = document.createElement('span');
                            span.style.cssText = "font-size: 0.8rem; color: #e74c3c; margin-left: 5px;";
                            span.innerText = "(Requires 1 completed order)";
                            if (currentCodRadio.parentElement) {
                                currentCodRadio.parentElement.style.opacity = '0.6';
                                currentCodRadio.parentElement.appendChild(span);
                            }
                        }
                    }
                })
                .catch(e => console.error('Error checking trust status', e));
        }
    }

    const form = document.getElementById('payment-form');
    const locateBtn = document.getElementById('locate-btn');
    if (locateBtn) {
        locateBtn.addEventListener('click', openLocationPickerMap);
    }

    form.addEventListener('submit', async (event) => {
        await processCheckout(event, customerContact);
    });
}

let appliedCoupon = null;
function applyCoupon() {
    const code = document.getElementById('coupon-code')?.value.toUpperCase();
    const msg = document.getElementById('coupon-msg');
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    let total = cart.reduce((sum, i) => sum + i.price * (i.quantity || 1), 0);
    
    if (code === 'APNA50') {
        if (total >= 200) {
            appliedCoupon = code;
            msg.style.color = '#2ecc71';
            msg.innerHTML = '✅ Coupon APNA50 applied! ₹50 off.';
            updatePaymentSummary(total, 50);
        } else {
            msg.style.color = '#e74c3c';
            msg.innerHTML = '❌ Minimum order of ₹200 required for this coupon.';
        }
    } else {
        msg.style.color = '#e74c3c';
        msg.innerHTML = '❌ Invalid coupon code.';
    }
}

function updatePaymentSummary(baseTotal, discount = 0) {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    let delivery = (baseTotal > 0 && baseTotal < 199) ? 40 : 0;
    let finalTotal = baseTotal - discount + delivery;
    
    const summaryEl = document.getElementById('checkout-summary');
    if (summaryEl) {
        let count = cart.reduce((sum, i) => sum + (i.quantity || 1), 0);
        summaryEl.innerHTML = `
            <strong>${count} Item(s)</strong> | Subtotal: ₹${baseTotal} <br>
            ${discount > 0 ? `<span style="color:#27ae60;">Discount: -₹${discount}</span><br>` : ''}
            ${delivery > 0 ? `<span style="color:#e74c3c;">Delivery: +₹${delivery}</span><br>` : '<span style="color:#27ae60;">Delivery: FREE</span><br>'}
            <span style="color: #e67e22; font-size: 1.5rem; font-weight: bold; display: inline-block; margin-top: 5px;">Total: ₹${finalTotal}</span>
        `;
    }
    const payBtn = document.getElementById('submit-payment-btn');
    if (payBtn) {
        payBtn.innerText = `Pay ₹${finalTotal} Securely`;
    }
}

function openLocationPickerMap() {
    // Dynamically inject Map library if it hasn't been loaded yet
    if (typeof L === 'undefined') {
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(css);

        const js = document.createElement('script');
        js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        js.onload = initLocationPickerMap;
        document.head.appendChild(js);
    } else {
        initLocationPickerMap();
    }
}

function initLocationPickerMap() {
    const overlay = document.createElement('div');
    overlay.id = 'map-modal';
    
    const mapContainer = document.createElement('div');
    mapContainer.id = 'map-container';
    
    const mapDiv = document.createElement('div');
    mapDiv.id = 'delivery-map';
    mapDiv.style.width = '100%';
    mapDiv.style.height = '100%';
    mapDiv.style.borderRadius = '8px';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.innerText = 'Cancel';
    cancelBtn.className = 'close-map';
    cancelBtn.onclick = () => document.body.removeChild(overlay);
    
    const confirmBtn = document.createElement('button');
    confirmBtn.innerText = 'Confirm Location';
    confirmBtn.className = 'close-map';
    confirmBtn.style.top = 'auto';
    confirmBtn.style.bottom = '15px';
    confirmBtn.style.right = '50%';
    confirmBtn.style.transform = 'translateX(50%)';
    confirmBtn.style.backgroundColor = '#2ecc71';
    confirmBtn.style.padding = '12px 25px';
    confirmBtn.style.fontSize = '1.1rem';
    
    mapContainer.appendChild(cancelBtn);
    mapContainer.appendChild(confirmBtn);
    mapContainer.appendChild(mapDiv);
    overlay.appendChild(mapContainer);
    document.body.appendChild(overlay);

    const map = L.map('delivery-map').setView([28.6139, 77.2090], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    let marker;

    function setMarker(lat, lng) {
        if (marker) map.removeLayer(marker);
        marker = L.marker([lat, lng], { draggable: true }).addTo(map);
        marker.on('dragend', function() {
            const pos = marker.getLatLng();
            map.setView(pos, map.getZoom());
        });
        map.setView([lat, lng], 16);
    }

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            pos => setMarker(pos.coords.latitude, pos.coords.longitude),
            () => setMarker(28.6139, 77.2090)
        );
    } else {
        setMarker(28.6139, 77.2090);
    }

    map.on('click', function(e) {
        setMarker(e.latlng.lat, e.latlng.lng);
    });

    confirmBtn.onclick = async () => {
        if (!marker) return;
        
        const pos = marker.getLatLng();
        document.body.removeChild(overlay);
        
        const locateBtn = document.getElementById('locate-btn');
        if (locateBtn) locateBtn.innerText = 'Locating...';

        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.lat}&lon=${pos.lng}`);
            const data = await res.json();
            
            const addr = data.address || {};
            const city = addr.city || addr.town || addr.village || addr.county || addr.state_district || '';
            const pincode = addr.postcode || '';
            const area = addr.suburb || addr.neighbourhood || addr.residential || addr.road || data.name || '';
            const house = addr.house_number || addr.building || '';
            
            const cityInput = document.getElementById('address-city');
            const pincodeInput = document.getElementById('address-pincode');
            const areaInput = document.getElementById('address-area');
            const flatInput = document.getElementById('address-flat');
            
            if (cityInput) cityInput.value = city;
            if (pincodeInput) pincodeInput.value = pincode;
            if (areaInput) areaInput.value = area;
            if (flatInput && house) flatInput.value = house;
            else if (flatInput && !flatInput.value) flatInput.value = "GPS: " + pos.lat.toFixed(4) + ", " + pos.lng.toFixed(4);
            
            if (locateBtn) {
                locateBtn.innerText = '📍 Map Located';
                locateBtn.style.backgroundColor = '#2ecc71';
            }
        } catch (e) {
            if (locateBtn) locateBtn.innerText = '📍 Map Locator';
            alert('Could not fetch address details automatically.');
        }
    };
}

async function processCheckout(event, savedContactStr) {
    event.preventDefault();
    const customerName = document.getElementById('card-name').value;
    const guestContact = document.getElementById('guest-contact')?.value || '';
    const payMethod = document.querySelector('input[name="pay_method"]:checked')?.value || 'online';
    
    const flat = document.getElementById('address-flat')?.value.trim() || '';
    const area = document.getElementById('address-area')?.value.trim() || '';
    const landmark = document.getElementById('address-landmark')?.value.trim() || '';
    const city = document.getElementById('address-city')?.value.trim() || '';
    const pincode = document.getElementById('address-pincode')?.value.trim() || '';
    
    if (!customerName) {
        document.getElementById('payment-message').textContent = 'Please tell us your name.';
        return;
    }
    if (!flat || !area || !city || !pincode) {
        document.getElementById('payment-message').textContent = 'Please complete all required delivery address fields!';
        return;
    }
    
    // Seamlessly save this successful address so it auto-fills next time they checkout
    if (savedContactStr) {
        localStorage.setItem(`savedDeliveryAddress_${savedContactStr}`, JSON.stringify({ flat, area, landmark, city, pincode }));
    }
    
    let deliveryAddress = `${flat}, ${area}`;
    if (landmark) deliveryAddress += `, Landmark: ${landmark}`;
    deliveryAddress += `, ${city} - ${pincode}`;

    const submitBtn = document.getElementById('submit-payment-btn');
    const originalText = submitBtn.innerText;
    submitBtn.disabled = true;
    submitBtn.innerText = 'Connecting to Secure Checkout...';

    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const token = localStorage.getItem('authToken');

    // Dynamically build return URLs so they work perfectly regardless of how the frontend is hosted (e.g., Live Server folders)
    const baseUrl = window.location.origin + window.location.pathname;
    const successUrl = baseUrl.replace('payment.html', 'my-orders.html') + '?session_id={CHECKOUT_SESSION_ID}';
    const cancelUrl = baseUrl;

    const payload = { 
        items: cart, 
        customerName: customerName, 
        contact: guestContact || savedContactStr,
        address: deliveryAddress,
        couponCode: appliedCoupon,
        successUrl: successUrl,
        cancelUrl: cancelUrl
    };

    if (payMethod === 'cod') {
        try {
            const response = await fetch(`${API_BASE_URL}/api/checkout-cod`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (data.success) {
                // Save order ID for guest tracking
                let guestOrders = JSON.parse(localStorage.getItem('guestOrders')) || [];
                guestOrders.push(data.orderId);
                localStorage.setItem('guestOrders', JSON.stringify(guestOrders));
                
                localStorage.removeItem('cart');
                window.location.href = 'my-orders.html';
            } else {
                document.getElementById('payment-message').textContent = data.error || 'Checkout failed.';
                submitBtn.disabled = false;
                submitBtn.innerText = originalText;
            }
        } catch (e) {
            document.getElementById('payment-message').textContent = 'Network error.';
            submitBtn.disabled = false;
            submitBtn.innerText = originalText;
        }
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/create-stripe-checkout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify(payload),
        });
        
        const data = await response.json();

        if (data.error || !data.id) {
            document.getElementById('payment-message').textContent = data.error || data.message || 'We could not start the checkout process. Please try again.';
            submitBtn.disabled = false;
            submitBtn.innerText = originalText;
            return;
        }

        if (typeof Stripe === 'undefined') {
            document.getElementById('payment-message').textContent = 'Stripe is not loaded. Please ensure you have included Stripe.js in your HTML.';
            submitBtn.disabled = false;
            submitBtn.innerText = originalText;
            return;
        }

        const stripe = Stripe(stripePublishableKey);
        const { error } = await stripe.redirectToCheckout({ sessionId: data.id });
        
        if (error) {
            document.getElementById('payment-message').textContent = error.message;
            submitBtn.disabled = false;
            submitBtn.innerText = originalText;
        }
    } catch (error) {
        console.error('Payment Initialization Error:', error);
        document.getElementById('payment-message').textContent = "Oops! Something went wrong connecting to the payment gateway.";
        submitBtn.disabled = false;
        submitBtn.innerText = originalText;
    }
}

async function verifyStripeSession(sessionId) {
    const token = localStorage.getItem('authToken');
    try {
        await fetch(`${API_BASE_URL}/api/verify-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
            body: JSON.stringify({ sessionId })
        });
    } catch (e) {
        console.error('Session verification failed:', e);
    }
}

/* --- Authentication Functions --- */
async function handleRegistration(event) {
    event.preventDefault();
    const name = document.getElementById('reg-name').value;
    const contact = document.getElementById('reg-contact').value;
    const password = document.getElementById('reg-password').value;

    try {
        const response = await fetch(`${API_BASE_URL}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, contact, password })
        });
        const data = await response.json();

        if (response.ok) {
            showCustomAlert('Account created successfully! Please login.', () => { window.location.href = 'login.html'; });
        } else {
            showCustomAlert(data.message || 'Registration failed.');
        }
    } catch (error) {
        console.error('Registration Error:', error);
        showCustomAlert('Network Error: Could not connect to the server.');
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const contact = document.getElementById('login-contact').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch(`${API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contact, password })
        });
        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('loggedInUser', JSON.stringify(data.user));
            localStorage.setItem('authToken', data.token);
            
            showCustomAlert(`Welcome back, ${data.user.name}!`, () => { 
                if (data.user.role === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'index.html'; 
                }
            });
        } else {
            showCustomAlert(data.message || 'Invalid credentials.');
        }
    } catch (error) {
        console.error('Login Error:', error);
        showCustomAlert('Network Error: Could not connect to the server.');
    }
}

async function handleGoogleLogin(response) {
    const id_token = response.credential;
    try {
        const res = await fetch(`${API_BASE_URL}/api/google-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: id_token })
        });
        const data = await res.json();
        
        if (res.ok) {
            localStorage.setItem('loggedInUser', JSON.stringify(data.user));
            localStorage.setItem('authToken', data.token);
            
            showCustomAlert(`Welcome, ${data.user.name}!`, () => { 
                if (data.user.role === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'index.html'; 
                }
            });
        } else {
            showCustomAlert(data.message || 'Google Login failed.');
        }
    } catch (error) {
        showCustomAlert('Server error. Ensure the backend is running.');
    }
}

async function initializeGoogleLogin() {
    const container = document.getElementById('google-btn-container');
    if (!container) return;

    try {
        const configRes = await fetch(`${API_BASE_URL}/api/config/google`);
        const { clientId } = await configRes.json();

        // Wait for Google library to load if it hasn't already
        const checkGoogle = setInterval(() => {
            if (typeof google !== 'undefined' && google.accounts) {
                clearInterval(checkGoogle);
                google.accounts.id.initialize({
                    client_id: clientId,
                    callback: handleGoogleLogin,
                    auto_prompt: false
                });
                google.accounts.id.renderButton(
                    container,
                    { theme: 'outline', size: 'large', type: 'standard' }
                );
            }
        }, 100);
    } catch (error) {
        console.error('Failed to load Google configuration.');
    }
}

function updateAuthNav() {
    const loggedInUser = localStorage.getItem('loggedInUser');
    const navLinks = document.querySelector('.nav-links');
    
    if (!navLinks) return;

    // Hide or show cart links globally based on login status
    const cartLinks = document.querySelectorAll('a[href="cart.html"]');
    cartLinks.forEach(link => {
        if (loggedInUser) {
            if (link.parentElement.tagName === 'LI') link.parentElement.style.display = 'list-item';
            else link.style.display = 'inline-block';
        } else {
            if (link.parentElement.tagName === 'LI') link.parentElement.style.display = 'none';
            else link.style.display = 'none';
        }
    });

    // Remove all auth-related links first to prevent duplicates
    navLinks.querySelectorAll('a').forEach(link => {
        const text = link.textContent;
        if (['Login', 'Sign Up', 'Logout', 'My Orders', 'Profile'].includes(text)) {
            link.parentElement.remove();
        }
    });

    if (loggedInUser) {
        // Add user-specific links
        const myOrdersLi = document.createElement('li');
        myOrdersLi.innerHTML = '<a href="my-orders.html">My Orders</a>';
        navLinks.appendChild(myOrdersLi);

        const profileLi = document.createElement('li');
        profileLi.innerHTML = '<a href="profile.html">Profile</a>';
        navLinks.appendChild(profileLi);

        const logoutLi = document.createElement('li');
        const logoutLink = document.createElement('a');
        logoutLink.textContent = 'Logout';
        logoutLink.href = '#';
        logoutLink.onclick = (e) => {
            e.preventDefault();
            handleLogout();
        };
        logoutLi.appendChild(logoutLink);
        navLinks.appendChild(logoutLi);
    } else {
        // Add guest links
        const loginLi = document.createElement('li');
        loginLi.innerHTML = '<a href="login.html">Login</a>';
        navLinks.appendChild(loginLi);

        const signupLi = document.createElement('li');
        signupLi.innerHTML = '<a href="register.html">Sign Up</a>';
        navLinks.appendChild(signupLi);
    }
}

function showRatingModal(orderId) {
    const existingMapModal = document.getElementById('map-modal');
    if (existingMapModal) {
        document.body.removeChild(existingMapModal);
    }

    const overlay = document.createElement('div');
    overlay.id = 'custom-alert-page'; // Re-use alert styles for the overlay

    const modalContent = document.createElement('div');
    modalContent.className = 'rating-modal-content';

    modalContent.innerHTML = `
        <h3>How was your order?</h3>
        <div class="star-rating">
            <input type="radio" id="5-stars" name="rating" value="5" /><label for="5-stars" class="star">&#9733;</label>
            <input type="radio" id="4-stars" name="rating" value="4" /><label for="4-stars" class="star">&#9733;</label>
            <input type="radio" id="3-stars" name="rating" value="3" /><label for="3-stars" class="star">&#9733;</label>
            <input type="radio" id="2-stars" name="rating" value="2" /><label for="2-stars" class="star">&#9733;</label>
            <input type="radio" id="1-star" name="rating" value="1" /><label for="1-star" class="star">&#9733;</label>
        </div>
        <textarea id="review-text" placeholder="Leave a review..."></textarea>
    `;

    const submitBtn = document.createElement('button');
    submitBtn.innerText = 'Submit Review';
    submitBtn.className = 'btn';
    submitBtn.style.marginTop = '1rem';
    submitBtn.onclick = () => {
        const rating = document.querySelector('input[name="rating"]:checked')?.value;
        const review = document.getElementById('review-text').value;
        if (!rating) {
            alert('Please select a star rating.');
            return;
        }
        submitReview(orderId, rating, review);
        document.body.removeChild(overlay);
    };

    modalContent.appendChild(submitBtn);
    overlay.appendChild(modalContent);
    document.body.appendChild(overlay);
}

async function submitReview(orderId, rating, review) {
    const token = localStorage.getItem('authToken');
    try {
        const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}/review`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ rating, review })
        });
        const data = await response.json();
        if (response.ok) {
            showCustomAlert(data.message || 'Thank you for your feedback!', () => loadMyOrders());
        } else {
            showCustomAlert(data.message || 'Could not submit review.');
        }
    } catch (error) {
        showCustomAlert('Error communicating with the server.');
    }
}

async function loadProfile() {
    const token = localStorage.getItem('authToken');
    try {
        const response = await fetch(`${API_BASE_URL}/api/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.status === 401 || response.status === 403) {
            showCustomAlert('Session expired. Please log in again.', () => window.location.href = 'login.html');
            return;
        }
        const data = await response.json();
        if (data.success) {
            const userName = data.user.name || 'User';
            const contact = data.user.contact || '';
            
            const displayName = document.getElementById('display-profile-name');
            if (displayName) {
                displayName.innerText = userName;
                document.getElementById('display-profile-contact').innerText = contact;
                document.getElementById('profile-initials').innerText = userName.charAt(0).toUpperCase();
            }
        }
        
        // Fetch last order for the "Repeat Order" quick action
        const ordersRes = await fetch(`${API_BASE_URL}/api/my-orders?limit=1`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (ordersRes.ok) {
            const orders = await ordersRes.json();
            const lastOrderNameEl = document.getElementById('last-order-name');
            if (orders && orders.length > 0 && orders[0].items && orders[0].items.length > 0) {
                const lastItems = orders[0].items;
                let summary = lastItems.map(i => escapeHTML(i.name)).join(', ');
                if(lastOrderNameEl) {
                    lastOrderNameEl.innerText = summary;
                    lastOrderNameEl.dataset.items = JSON.stringify(lastItems); 
                }
            } else {
                if(lastOrderNameEl) lastOrderNameEl.innerText = "No past orders";
            }
        }
    } catch (error) {
        showCustomAlert('Error fetching profile.');
    }
}

function repeatLastOrder() {
    const lastOrderNameEl = document.getElementById('last-order-name');
    if (!lastOrderNameEl || !lastOrderNameEl.dataset.items) {
        showCustomAlert("You have no past orders to repeat yet!");
        return;
    }
    try {
        const items = JSON.parse(lastOrderNameEl.dataset.items);
        let cart = JSON.parse(localStorage.getItem('cart')) || [];
        
        items.forEach(pastItem => {
            let existing = cart.find(i => i.name === pastItem.name);
            if (existing) {
                existing.quantity = (existing.quantity || 1) + (pastItem.quantity || 1);
            } else {
                cart.push({ name: pastItem.name, price: pastItem.price, quantity: pastItem.quantity || 1 });
            }
        });
        
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartCount();
        
        showCustomAlert("Items from your last order have been added to the cart!", () => {
            window.location.href = 'cart.html';
        });
    } catch(e) {
        showCustomAlert("Could not process repeat order.");
    }
}

function handleLogout() {
    showCustomAlert("Are you sure you want to log out?", () => {
        localStorage.removeItem('loggedInUser');
        localStorage.removeItem('authToken');
        localStorage.removeItem('cart'); // Clear cart on logout
        window.location.href = 'index.html';
    });
}

function showEditProfileModal() {
    const overlay = document.createElement('div');
    overlay.id = 'custom-alert-page';
    
    const content = document.createElement('div');
    content.className = 'custom-alert-box';
    content.style.textAlign = 'left';
    
    const currentUser = JSON.parse(localStorage.getItem('loggedInUser')) || {};
    
    content.innerHTML = `
        <h3 style="margin-bottom: 1rem; color: #2c3e50; text-align: center;">Edit Profile</h3>
        <form id="edit-profile-form" style="display: flex; flex-direction: column; gap: 1rem;">
            <div>
                <label style="font-weight: bold; display: block; margin-bottom: 0.3rem;">Name</label>
                <input type="text" id="profile-name" value="${escapeHTML(currentUser.name || '')}" required style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
            </div>
            <div>
                <label style="font-weight: bold; display: block; margin-bottom: 0.3rem;">Contact (Email/Phone)</label>
                <input type="text" id="profile-contact" value="${escapeHTML(currentUser.contact || '')}" required style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
            </div>
            <div>
                <label style="font-weight: bold; display: block; margin-bottom: 0.3rem;">New Password (Optional)</label>
                <input type="password" id="profile-password" placeholder="Leave blank to keep current" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
            </div>
            <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                <button type="submit" class="btn" style="flex: 1;">Save Changes</button>
                <button type="button" class="btn" style="flex: 1; background-color: #95a5a6;" onclick="document.body.removeChild(this.closest('#custom-alert-page'))">Cancel</button>
            </div>
        </form>
    `;
    
    overlay.appendChild(content);
    document.body.appendChild(overlay);
    
    document.getElementById('edit-profile-form').onsubmit = handleProfileUpdate;
}

async function handleProfileUpdate(event) {
    event.preventDefault();
    const token = localStorage.getItem('authToken');
    const name = document.getElementById('profile-name').value;
    const contact = document.getElementById('profile-contact').value;
    const password = document.getElementById('profile-password').value;

    try {
        const response = await fetch(`${API_BASE_URL}/api/profile`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, contact, password: password || undefined })
        });
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('loggedInUser', JSON.stringify(data.user));
            showCustomAlert('Profile updated successfully!', () => window.location.reload());
        } else {
            showCustomAlert(data.message || 'Failed to update profile.');
        }
    } catch (error) {
        showCustomAlert('Error updating profile.');
    }
}

async function viewReceipt(orderId) {
    const token = localStorage.getItem('authToken');
    try {
        const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            showReceiptModal(data.order);
        } else {
            showCustomAlert(data.message || 'Could not fetch receipt.');
        }
    } catch (error) {
        showCustomAlert('Error communicating with server.');
    }
}

function showReceiptModal(order) {
    const overlay = document.createElement('div');
    overlay.id = 'custom-alert-page';

    const modalContent = document.createElement('div');
    modalContent.className = 'receipt-modal-content';

    const itemsHtml = order.items.map(item => `
        <div class="receipt-item">
            <span>${escapeHTML(item.name)}</span>
            <span>₹${Number(item.price) || 0}</span>
        </div>
    `).join('');
    const displayAddress = escapeHTML(order.address || 'N/A').replace(/\n/g, '<br>');

    modalContent.innerHTML = `
        <h3>Kajal Ki Rasoi<br><span style="font-size: 0.9rem; font-weight: normal;">Order #${escapeHTML((order._id || order.id).toString().slice(-5))}</span></h3>
        <p style="font-size: 0.85rem; text-align: center; margin-bottom: 0.5rem;">${new Date(order.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
        <p style="font-size: 0.85rem; text-align: center; margin-bottom: 1.5rem; word-wrap: break-word;"><strong>Deliver to:</strong><br><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address || '')}" target="_blank" style="color: #3498db; text-decoration: none;">${displayAddress} 📍</a></p>
        ${itemsHtml}
        <div class="receipt-total">
            <span>Total</span>
            <span>₹${Number(order.total) || 0}</span>
        </div>
        <button class="btn close-receipt" onclick="document.body.removeChild(this.parentElement.parentElement)">Close</button>
    `;

    overlay.appendChild(modalContent);
    document.body.appendChild(overlay);
}

/* --- Subscription Flow --- */
function openSubscriptionModal(plan, frequency, price, persons = 1) {
    const overlay = document.createElement('div');
    overlay.id = 'custom-alert-page';
    
    const content = document.createElement('div');
    content.className = 'custom-alert-box';
    content.style.textAlign = 'left';
    
    const currentUser = JSON.parse(localStorage.getItem('loggedInUser')) || {};
    const freqText = frequency === 7 && plan.includes('Trial') ? '7-Day Trial' : `${frequency} Days/Week`;
    const personsText = persons === 1 ? '1 Person' : `${persons} People`;
    
    // Default to tomorrow
    const tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 1);
    const tmrwStr = tmrw.toISOString().split('T')[0];

    content.innerHTML = `
        <h3 style="margin-bottom: 0.5rem; color: #2c3e50; text-align: center;">Confirm Subscription</h3>
        <p id="sub-price-display" style="text-align: center; color: #666; font-size: 0.9rem; margin-bottom: 1.5rem;">${plan} (${freqText} &bull; ${personsText}) - ₹${price}</p>
        <form id="subscription-form" style="display: flex; flex-direction: column; gap: 1rem;">
            <div>
                <label style="font-weight: bold; display: block; margin-bottom: 0.3rem;">Full Name</label>
                <input type="text" id="sub-name" value="${escapeHTML(currentUser.name || '')}" required style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px;">
            </div>
            <div>
                <label style="font-weight: bold; display: block; margin-bottom: 0.3rem;">Contact Number</label>
                <input type="text" id="sub-contact" value="${escapeHTML(currentUser.contact || '')}" required style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px;">
            </div>
            <div>
                <label style="font-weight: bold; display: block; margin-bottom: 0.3rem;">Delivery Address</label>
                <textarea id="sub-address" required style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; min-height: 60px;"></textarea>
            </div>
            <div>
                <label style="font-weight: bold; display: block; margin-bottom: 0.3rem;">Start Date</label>
                <input type="date" id="sub-start-date" value="${tmrwStr}" min="${tmrwStr}" required style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px;">
            </div>
            <div>
                <label style="font-weight: bold; display: block; margin-bottom: 0.3rem;">Have a Coupon?</label>
                <div style="display: flex; gap: 10px;">
                    <input type="text" id="sub-coupon-code" placeholder="e.g. APNA50" style="padding: 10px; flex: 1; border: 1px solid #ccc; border-radius: 4px;">
                    <button type="button" class="btn" style="padding: 10px;" id="apply-sub-coupon-btn">Apply</button>
                </div>
                <div id="sub-coupon-msg" style="font-size: 0.85rem; margin-top: 5px;"></div>
            </div>
            <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                <button type="button" class="btn" style="flex: 1; background-color: #95a5a6;" onclick="document.body.removeChild(this.closest('#custom-alert-page'))">Cancel</button>
                <button type="button" id="sub-pay-later" class="btn" style="flex: 1; background-color: #f39c12; padding: 10px;">Pay Later</button>
                <button type="button" id="sub-pay-now" class="btn" style="flex: 1; padding: 10px;">Pay Online</button>
            </div>
        </form>
    `;
    
    overlay.appendChild(content);
    document.body.appendChild(overlay);
    
    let finalPrice = price;
    let appliedCouponCode = null;
    
    document.getElementById('apply-sub-coupon-btn').onclick = () => {
        const code = document.getElementById('sub-coupon-code').value.toUpperCase().trim();
        const msg = document.getElementById('sub-coupon-msg');
        if (code === 'APNA50') {
            if (price >= 200) {
                appliedCouponCode = code;
                finalPrice = price - 50;
                msg.style.color = '#2ecc71';
                msg.innerHTML = '✅ Coupon APNA50 applied! ₹50 off.';
                document.getElementById('sub-price-display').innerHTML = `<strong>${plan} (${freqText} &bull; ${personsText}) - <span style="color:#27ae60;">₹${finalPrice}</span></strong>`;
            } else {
                msg.style.color = '#e74c3c';
                msg.innerHTML = '❌ Minimum value of ₹200 required.';
            }
        } else {
            msg.style.color = '#e74c3c';
            msg.innerHTML = '❌ Invalid coupon code.';
        }
    };
    
    document.getElementById('sub-pay-later').onclick = (e) => submitSubscription(e, plan, frequency, finalPrice, persons, appliedCouponCode, overlay, 'offline');
    document.getElementById('sub-pay-now').onclick = (e) => submitSubscription(e, plan, frequency, finalPrice, persons, appliedCouponCode, overlay, 'online');
}

async function submitSubscription(e, plan, frequency, price, persons, couponCode, modalOverlay, method) {
    e.preventDefault();
    
    const form = document.getElementById('subscription-form');
    if (!form.reportValidity()) return;
    
    const token = localStorage.getItem('authToken');
    const payload = {
        plan, frequency, price, persons, couponCode,
        customerName: document.getElementById('sub-name').value,
        contact: document.getElementById('sub-contact').value,
        address: document.getElementById('sub-address').value,
        startDate: document.getElementById('sub-start-date').value
    };

    if (method === 'offline') {
        try {
            const res = await fetch(`${API_BASE_URL}/api/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok) {
                document.body.removeChild(modalOverlay);
                showCustomAlert(data.message, () => window.location.reload());
            } else { showCustomAlert(data.message || 'Failed to submit request.'); }
        } catch (err) { showCustomAlert('Network error connecting to server.'); }
    } else {
        if (typeof Stripe === 'undefined') {
            await new Promise(resolve => {
                const script = document.createElement('script');
                script.src = 'https://js.stripe.com/v3/';
                script.onload = resolve;
                document.head.appendChild(script);
            });
        }
        try {
            let configRes = await fetch(`${API_BASE_URL}/api/config/stripe`);
            let { publishableKey } = await configRes.json();
            
            payload.successUrl = window.location.origin + window.location.pathname + '?sub_success=true';
            payload.cancelUrl = window.location.origin + window.location.pathname;

            const res = await fetch(`${API_BASE_URL}/api/create-stripe-subscription-checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.id) {
                const stripe = Stripe(publishableKey);
                stripe.redirectToCheckout({ sessionId: data.id });
            } else { showCustomAlert(data.error || 'Checkout failed.'); }
        } catch (err) { showCustomAlert('Payment error.'); }
    }
}