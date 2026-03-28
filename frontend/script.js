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

function isTokenExpired(token) {
    if (!token) return true;
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(atob(base64));
        return Math.floor(Date.now() / 1000) >= payload.exp;
    } catch (e) {
        return true;
    }
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

        // Close mobile menu when clicking anywhere outside the navbar
        document.addEventListener('click', (e) => {
            if (navbar.classList.contains('menu-open') && !navbar.contains(e.target)) {
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
        // Add event listener for menu card interactions
        const menuContainer = document.getElementById('dynamic-menu-container');
        if (menuContainer) {
            menuContainer.addEventListener('click', handleMenuInteraction);
        }
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
            showSystemToast('Error', 'Access Denied. Administrator login required.', 'error');
            setTimeout(() => {
                localStorage.removeItem('loggedInUser');
                localStorage.removeItem('authToken');
                window.location.href = 'login.html';
            }, 2000);
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
        showSystemToast('Success', 'Payment successful! Your subscription is now Active. 🎉');
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
        const passwordInput = document.getElementById('login-password');
        const passwordToggle = document.getElementById('password-toggle');
        if (passwordInput && passwordToggle) {
            passwordToggle.addEventListener('click', () => {
                const isPassword = passwordInput.getAttribute('type') === 'password';
                passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
                passwordToggle.textContent = isPassword ? '🙈' : '👁️';
            });
        }
    }

    if (window.location.pathname.includes('register.html')) {
        initializeGoogleLogin();
        const passwordInput = document.getElementById('reg-password');
        const passwordToggle = document.getElementById('password-toggle');
        const strengthMeter = document.getElementById('password-strength-meter');

        if (passwordInput && passwordToggle) {
            passwordToggle.addEventListener('click', () => {
                const isPassword = passwordInput.getAttribute('type') === 'password';
                passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
                passwordToggle.textContent = isPassword ? '🙈' : '👁️';
            });
        }

        if (passwordInput && strengthMeter) {
            passwordInput.addEventListener('input', () => {
                updatePasswordStrength(passwordInput.value);
            });
        }
    }

    if (window.location.pathname.includes('reset-password.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        
        if (!token) {
            showSystemToast('Error', 'Invalid or missing reset token.', 'error');
            setTimeout(() => window.location.href = 'login.html', 2000);
        } else {
            const resetForm = document.getElementById('reset-password-form');
            if (resetForm) {
                resetForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const newPassword = document.getElementById('reset-password').value;
                    try {
                        const response = await fetch(`${API_BASE_URL}/api/reset-password`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ token, newPassword })
                        });
                        const data = await response.json();
                        if (response.ok) { showSystemToast('Success', data.message); setTimeout(() => window.location.href = 'login.html', 2000); } 
                        else { showSystemToast('Error', data.message, 'error'); }
                    } catch (error) {
                        showSystemToast('Error', 'Error connecting to server.', 'error');
                    }
                });
            }
        }
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
                    showSystemToast('Success', 'Your order has been delivered! Please consider leaving a review.');
                }
                loadMyOrders();
            }
        });
    }
});

function showStickyCart() {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    let sticky = document.getElementById('sticky-cart');
    if (!sticky) return;
    const token = localStorage.getItem('authToken');

    if (cart.length > 0 && token) {
        const itemCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
        const currentTotal = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);

        // Mock original price and discount for demonstration, as this data isn't in the backend.
        const discountPercentage = 17;
        const originalTotal = Math.round(currentTotal / (1 - (discountPercentage / 100)));
        const hasDiscount = originalTotal > currentTotal + 1; // Only show if discount is meaningful

        // Dynamic delivery nudge logic
        const freeDeliveryThreshold = 299;
        let deliveryNudgeHTML = '';
        if (currentTotal < freeDeliveryThreshold) {
            const amountNeeded = freeDeliveryThreshold - currentTotal;
            deliveryNudgeHTML = `<p class="sc-delivery-nudge">Add ₹${amountNeeded} more for free delivery</p>`;
        } else {
            deliveryNudgeHTML = `<p class="sc-delivery-nudge" style="color: #16a34a;">You've unlocked Free Delivery!</p>`;
        }

        sticky.innerHTML = `
            <div class="sc-left">
                <div class="sc-icon-pill">
                    🛒
                    <span class="sc-item-count">${itemCount}</span>
                </div>
                <div class="sc-details">
                    <p class="sc-info-label">${itemCount} item${itemCount > 1 ? 's' : ''} in cart</p>
                    <div class="sc-price-row">
                        <span class="sc-price-current">₹${currentTotal}</span>
                        ${hasDiscount ? `<s class="sc-price-original">₹${originalTotal}</s>` : ''}
                        ${hasDiscount ? `<span class="sc-discount-badge">${discountPercentage}% OFF</span>` : ''}
                    </div>
                </div>
            </div>
            <div class="sc-right">
                <a href="cart.html" class="sc-cta-btn">View Cart →</a>
                ${deliveryNudgeHTML}
            </div>
        `;
        sticky.style.display = 'flex';
    } else {
        sticky.style.display = 'none';
    }
}

let allMenuItems = []; // To store all menu items for filtering

function generateMenuItemHTML(item, cart) {
    const safeName = escapeHTML(item.name);
    const itemImage = item.imageUrl && item.imageUrl.trim() !== '' ? escapeHTML(item.imageUrl) : getDefaultImage(safeName);
    const isBestseller = safeName.includes('Thali') || safeName.includes('Paneer') || safeName.includes('Biryani');
    const isRecommended = item.category === "🌟 Today's Special";
    const isVeg = !safeName.toLowerCase().includes('chicken') && !safeName.toLowerCase().includes('egg');
    const urgency = Math.random() > 0.85 && item.available !== false ? `<span class="urgency-text">🔥 Only a few left!</span>` : '';
    const isAvailable = item.available !== false;

    // Mock data for visual representation as it's not in the backend schema
    const ratings = ["4.1", "4.2", "4.3", "4.4", "4.5", "4.6", "4.7", "4.8"];
    const rating = ratings[Math.floor(Math.random() * ratings.length)];
    const deliveryTimes = ["20-25 min", "25-30 min", "30-35 min", "35-40 min"];
    const deliveryTime = deliveryTimes[Math.floor(Math.random() * deliveryTimes.length)];

    const cartItem = cart.find(i => i.name === safeName);
    const quantity = cartItem ? cartItem.quantity : 0;

    let actionControlHTML;
    if (isAvailable) {
        if (quantity > 0) {
            actionControlHTML = `
                <div class="qty-stepper">
                    <button data-action="decrease">-</button>
                    <span>${quantity}</span>
                    <button data-action="increase">+</button>
                </div>
            `;
        } else {
            actionControlHTML = `<button class="btn-order" data-action="add">＋ Add</button>`;
        }
    } else {
        actionControlHTML = `<button class="btn-order" style="background-color: #95a5a6; cursor: not-allowed;" disabled>Sold Out</button>`;
    }

    let tagHtml = '';
    if (isRecommended && isAvailable) {
        tagHtml = '<span class="badge badge-recommended">🔥 Recommended</span>';
    } else if (isBestseller && isAvailable) {
        tagHtml = '<span class="badge badge-bestseller">⭐ Best Seller</span>';
    }
    
    return `
        <div class="menu-card ${!isAvailable ? 'item-unavailable' : ''}" data-name="${safeName}" data-price="${item.price}">
            <div class="card-img-container">
                <img src="${itemImage}" alt="${safeName}" class="card-img" loading="lazy">
                ${tagHtml}
                ${isVeg && isAvailable ? '<span class="badge badge-veg"><span class="veg-dot"></span>Veg</span>' : ''}
                ${!isAvailable ? '<span class="badge badge-sold-out">Sold Out</span>' : ''}
            </div>
            <div class="card-content">
                <div class="card-title-row">
                    <h3>${safeName}</h3>
                </div>
                <p class="card-description">${escapeHTML(item.description || '')}</p>
                ${urgency}
                <div class="card-meta-info">
                    <span class="meta-rating">★ ${rating}</span>
                    <span class="meta-delivery">· ${deliveryTime}</span>
                </div>
                <div class="card-footer">
                    <span class="price">₹${item.price}</span>
                    <div class="card-action-control">${actionControlHTML}</div>
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

    const cart = JSON.parse(localStorage.getItem('cart')) || [];
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
            html += groupedMenu[cat].map(item => generateMenuItemHTML(item, cart)).join('');
            html += '</div>';
        }
    });

    container.innerHTML = html || '<p class="empty-cart" style="text-align: center; padding: 2rem;">No items match your filters.</p>';
}

function handleMenuInteraction(event) {
    const target = event.target;
    const card = target.closest('.menu-card');
    if (!card) return;

    const action = target.dataset.action;
    if (!action) return;

    const itemName = card.dataset.name;
    const itemPrice = parseFloat(card.dataset.price);
    
    const token = localStorage.getItem('authToken');
    if (!token || isTokenExpired(token)) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('loggedInUser');
        showSystemToast('Info', 'Your session has expired or you are not logged in. Please login to continue.');
        setTimeout(() => { window.location.href = 'login.html'; }, 2000);
        return;
    }

    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    let itemInCart = cart.find(i => i.name === itemName);
    let itemIndex = cart.findIndex(i => i.name === itemName);

    if (action === 'add') {
        if (!itemInCart) {
            cart.push({ name: itemName, price: itemPrice, quantity: 1 });
        }
    } else if (action === 'increase') {
        if (itemInCart) {
            itemInCart.quantity++;
        }
    } else if (action === 'decrease') {
        if (itemInCart) {
            itemInCart.quantity--;
            if (itemInCart.quantity <= 0) {
                cart.splice(itemIndex, 1);
            }
        }
    }

    localStorage.setItem('cart', JSON.stringify(cart));
    
    updateCardActionControl(card, cart);

    updateCartCount();
    showStickyCart();

    if (action === 'add') {
        showToast(itemName, itemPrice);
        const cartIcon = document.querySelector('.nav-cart-icon');
        if (cartIcon) {
            cartIcon.classList.remove('cart-bump');
            void cartIcon.offsetWidth;
            cartIcon.classList.add('cart-bump');
        }
    }
}

function updateCardActionControl(cardElement, cart) {
    const itemName = cardElement.dataset.name;
    const actionContainer = cardElement.querySelector('.card-action-control');
    if (!actionContainer) return;
    
    const cartItem = cart.find(i => i.name === itemName);
    const quantity = cartItem ? cartItem.quantity : 0;

    let newHTML;
    if (quantity > 0) {
        newHTML = `
            <div class="qty-stepper">
                <button data-action="decrease">-</button>
                <span>${quantity}</span>
                <button data-action="increase">+</button>
            </div>`;
    } else {
        newHTML = `<button class="btn-order" data-action="add">＋ Add</button>`;
    }
    actionContainer.innerHTML = newHTML;
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

function showToast(itemName, price) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    // Remove redundant price inside parentheses if it exists in the name
    const cleanItemName = itemName.replace(/\s*\([^)]*\)/g, '');

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    
    toast.innerHTML = `
        <div class="toast-header">
            <div class="toast-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
            <div class="toast-content">
                <div class="toast-title">Added to cart!</div>
                <div class="toast-desc">
                    <strong style="color: #1a0e00;">${escapeHTML(cleanItemName)}</strong><br>
                    <span style="color: #f97316; font-weight: 600;">₹${price}</span>
                    <span style="color: #9ca3af; font-size: 12px; margin-left: 8px;">Qty: 1</span>
                </div>
            </div>
            <button class="toast-close">&times;</button>
        </div>
        <div class="toast-actions">
            <a href="cart.html" class="toast-btn toast-btn-primary">View Cart</a>
            <button class="toast-btn toast-btn-secondary toast-keep-browsing">Keep Browsing</button>
        </div>
        <div class="toast-progress">
            <div class="toast-progress-bar"></div>
        </div>
    `;

    container.appendChild(toast);

    const removeToast = () => {
        if (toast.classList.contains('hiding')) return;
        toast.classList.add('hiding');
        toast.addEventListener('animationend', () => {
            if (toast.parentElement) toast.parentElement.removeChild(toast);
        });
    };

    const timeout = setTimeout(removeToast, 4000);

    toast.querySelector('.toast-close').addEventListener('click', () => {
        clearTimeout(timeout);
        removeToast();
    });

    toast.querySelector('.toast-keep-browsing').addEventListener('click', () => {
        clearTimeout(timeout);
        removeToast();
    });
}

function showSystemToast(title, message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    
    const icon = type === 'success' ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : '❌';
    const iconColor = type === 'success' ? '#f97316' : '#e74c3c';
    const progressColor = type === 'success' ? '#f97316' : '#e74c3c';

    toast.innerHTML = `
        <div class="toast-header">
            <div class="toast-icon" style="color: ${iconColor}">${icon}</div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-desc">${escapeHTML(message)}</div>
            </div>
            <button class="toast-close">&times;</button>
        </div>
        <div class="toast-progress">
            <div class="toast-progress-bar" style="background: ${progressColor};"></div>
        </div>
    `;

    container.appendChild(toast);
    const removeToast = () => {
        if (toast.classList.contains('hiding')) return;
        toast.classList.add('hiding');
        toast.addEventListener('animationend', () => { if (toast.parentElement) toast.parentElement.removeChild(toast); });
    };
    const timeout = setTimeout(removeToast, 4000);
    toast.querySelector('.toast-close').addEventListener('click', () => { clearTimeout(timeout); removeToast(); });
}

function updatePasswordStrength(password) {
    const strengthMeter = document.getElementById('password-strength-meter');
    if (!strengthMeter) return;
    
    const bars = strengthMeter.querySelectorAll('.strength-bar');
    let strength = 0;

    if (password.length >= 8) strength++;
    if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[^a-zA-Z0-9]/)) strength++;

    bars.forEach((bar, index) => {
        bar.className = 'strength-bar'; // Reset
        if (index < strength) {
            if (strength === 1) bar.classList.add('weak');
            else if (strength === 2) bar.classList.add('medium');
            else if (strength === 3) bar.classList.add('strong');
            else if (strength === 4) bar.classList.add('very-strong');
        }
    });
}

function checkoutCart() {
    const token = localStorage.getItem('authToken');
    if (!token || isTokenExpired(token)) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('loggedInUser');
        showSystemToast('Error', 'Session expired. Please login again to checkout.', 'error');
        setTimeout(() => { window.location.href = 'login.html'; }, 2000);
        return;
    }

    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    if (cart.length === 0) {
        showSystemToast('Info', 'Your cart is empty!');
        return;
    }
    window.location.href = 'payment.html';
}

async function handleContactSubmit(event) {
    event.preventDefault();
    
    const name = document.getElementById('contact-name').value;
    const contact = document.getElementById('contact-email-phone').value.trim();
    const message = document.getElementById('contact-message').value;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^(?:\+91[\-\s]?)?\d{10}$/;
    if (!emailRegex.test(contact) && !phoneRegex.test(contact)) {
        showSystemToast('Error', 'Please enter a valid email address or a 10-digit phone number.', 'error');
        return;
    }

    const submitBtn = document.getElementById('contact-submit-btn');
    
    const originalText = submitBtn.innerText;
    submitBtn.disabled = true;
    submitBtn.innerText = 'Sending...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/contact`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, contact, message })
        });
        const data = await response.json();
        if (response.ok) {
            showSystemToast('Success', 'Message sent successfully!');
            event.target.reset(); // clear the form
        } else { showSystemToast('Error', data.message || 'Failed to send message.', 'error'); }
    } catch (error) { showSystemToast('Error', 'Error connecting to the server.', 'error'); } 
    
    submitBtn.disabled = false;
    submitBtn.innerText = originalText;
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

        const pendingCount = orderCountsMap['Pending'] || 0;
        const navOrdersLink = document.getElementById('nav-orders');
        if (navOrdersLink) {
            let badge = navOrdersLink.querySelector('.sidebar-badge');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'sidebar-badge';
                navOrdersLink.appendChild(badge);
            }
            badge.textContent = pendingCount;
            badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
        }
    } catch (error) {
        container.innerHTML = '<p style="color:red;">Error connecting to server for stats.</p>';
    }
}

let currentAdminOrderFilter = 'All';

async function loadAdminOrders(filter = currentAdminOrderFilter) {
    currentAdminOrderFilter = filter;
    const container = document.getElementById('admin-orders-container');
    if (!container) return;

    // Apply flex column layout directly to main wrapper
    container.classList.remove('admin-grid');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '0';

    const oldFilters = document.querySelector('.admin-filters');
    if (oldFilters) oldFilters.style.display = 'none';

    const params = new URLSearchParams();
    if (filter === 'Pending') params.append('status', 'Pending');
    else if (filter === 'Out for Delivery') params.append('status', 'Out for Delivery');
    else if (filter === 'Delivered') params.append('status', 'Completed');
    else if (filter === 'COD') params.append('paymentMethod', 'COD');
    else if (filter === 'Online') params.append('paymentMethod', 'Online');

    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/api/orders?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.status === 401 || response.status === 403) {
            showSystemToast('Error', 'Session expired or unauthorized access.', 'error');
            setTimeout(() => { window.location.href = 'login.html'; }, 2000);
            return;
        }
        
        const orders = await response.json();
        
        const headerHtml = `
            <div class="admin-pill-filters">
                ${['All', 'Pending', 'Out for Delivery', 'Delivered', 'COD', 'Online'].map(f => 
                    `<button class="filter-pill ${f === currentAdminOrderFilter ? 'active' : ''}" onclick="loadAdminOrders('${f}')">${f}</button>`
                ).join('')}
            </div>
        `;

        if (!Array.isArray(orders) || orders.length === 0) {
            container.innerHTML = headerHtml + '<p class="empty-cart">No matching orders found.</p>';
            return;
        }

        const ordersHtml = orders.map(order => {
            const safeId = order._id || order.id || '00000';
            const status = order.status || 'Pending';
            const statusClass = status.toLowerCase().replace(/ /g, '-');
            const items = Array.isArray(order.items) ? order.items : [];
            const itemsList = items.map(i => `
                <li style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; color: #374151; font-size: 0.95rem;">
                    <span style="width: 4px; height: 4px; background-color: #f97316; border-radius: 50%; display: inline-block;"></span>
                    ${i.quantity || 1}x ${escapeHTML(i.name) || 'Item'}
                </li>
            `).join('');
            const displayAddress = escapeHTML(order.address || 'N/A').replace(/\n/g, ', ');
            const orderTimestamp = new Date(order.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

            const rawName = order.customerName || 'Guest';
            const formattedName = rawName.toLowerCase().split(' ').map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : '').join(' ');

            let actionButtons = '';
            switch (status) {
                case 'Pending':
                    actionButtons = `
                        <button class="btn-order" style="padding: 6px 16px; background-color: #f97316; color: white; border: none; border-radius: 6px;" onclick="updateOrderStatus('${safeId}', 'Preparing')">Accept</button>
                        <button class="btn-order" style="padding: 6px 16px; background-color: transparent; color: #dc2626; border: 1px solid #dc2626; border-radius: 6px;" onclick="updateOrderStatus('${safeId}', 'Rejected')">Reject</button>
                    `;
                    break;
                case 'Preparing':
                    actionButtons = `<button class="btn-order" style="padding: 6px 16px; background-color: #3b82f6; color: white; border: none; border-radius: 6px;" onclick="updateOrderStatus('${safeId}', 'Out for Delivery')">Dispatch</button>`;
                    break;
                case 'Out for Delivery':
                    actionButtons = `<button class="btn-order" style="padding: 6px 16px; background-color: #22c55e; color: white; border: none; border-radius: 6px;" onclick="updateOrderStatus('${safeId}', 'Completed')">Mark Delivered</button>`;
                    break;
                case 'Completed':
                case 'Rejected':
                case 'Cancelled':
                    actionButtons = `<button class="btn-order" style="padding: 6px 16px; background-color: #6b7280; color: white; border: none; border-radius: 6px;" onclick="deleteOrder('${safeId}')">Archive</button>`;
                    break;
            }

            return `
                <div class="order-card status-${statusClass}">
                    <div class="order-header">
                        <h3 style="margin:0; color: var(--admin-text-main);">Order #${escapeHTML(safeId.toString().slice(-5))}</h3>
                        <span class="status ${statusClass}">${escapeHTML(status)}</span>
                    </div>
                    <div style="margin-bottom: 12px; font-size: 0.95rem; color: var(--admin-text-main);">
                        <p style="margin: 0 0 4px 0;"><strong>Customer:</strong> ${escapeHTML(formattedName)}</p>
                        <p style="margin: 0 0 4px 0;"><strong>Contact:</strong> <a href="tel:${escapeHTML(order.contact || '')}" style="color: #e67e22; text-decoration: none;">${escapeHTML(order.contact || 'N/A')}</a></p>
                        <p style="margin: 0 0 4px 0;"><strong>Payment:</strong> <span style="background: var(--admin-bg); padding: 2px 6px; border-radius: 4px; font-size: 0.85rem;">${escapeHTML(order.paymentMethod || 'Online')}</span></p>
                        <p style="margin: 0 0 4px 0;"><strong>Address:</strong> ${displayAddress} <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address || '')}" target="_blank" class="navigate-link" title="Click to navigate on Google Maps">📍 Navigate</a></p>
                    </div>
                    ${order.rating ? `<p style="color: #f39c12; margin: 0.5rem 0;"><strong>Rating:</strong> ${'★'.repeat(order.rating)}${'☆'.repeat(5 - order.rating)} <br><span style="color: #555; font-size: 0.9rem; font-style: italic;">"${escapeHTML(order.review || '')}"</span></p>` : ''}
                    <ul class="order-items-list" style="background: #f9fafb; border-radius: 8px; padding: 8px 10px; list-style: none; margin: 1rem 0;">
                        ${itemsList}
                    </ul>
                    <div class="order-footer" style="border-top: 0.5px solid #f3f4f6; display: flex; justify-content: space-between; align-items: center; padding-top: 1rem; margin-top: 1rem;">
                        <div class="footer-left" style="display: flex; flex-direction: column; gap: 4px;">
                            <strong style="font-size: 1.1rem; color: var(--admin-text-main);">Total: ₹${Number(order.total) || 0}</strong>
                            <span style="font-size: 0.85rem; color: #6b7280;">${orderTimestamp || 'N/A'}</span>
                        </div>
                        <div class="order-actions">
                            ${actionButtons}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = headerHtml + `<div class="admin-grid">${ordersHtml}</div>`;
    } catch (error) {
        showSystemToast('Error', 'Error connecting to the backend server.', 'error');
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
    } catch (error) { showSystemToast('Error', 'Failed to update subscription status.', 'error'); }
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
        showSystemToast('Error', 'Error fetching customer history.', 'error');
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
            showSystemToast('Error', 'Session expired. Please log in again.', 'error');
            setTimeout(() => window.location.href = 'login.html', 2000);
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

    // Mock arrival time for demonstration
    const arrivalTime = new Date(Date.now() + 35 * 60 * 1000).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

    return `
        <div class="active-order-card">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap;">
                <div>
                    <p style="font-size: 0.9rem; color: var(--admin-text-muted); margin-bottom: 0;">Estimated Delivery</p>
                    <p style="font-size: 2.2rem; font-weight: bold; color: #2ecc71; margin-top: 0; line-height: 1;">${eta}</p>
                    <p style="font-size: 13px; color: #888; margin-top: -5px;">Arrives by ${arrivalTime}</p>
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

            <div style="margin-top: 2.5rem; background: var(--admin-bg); padding: 1rem; border-radius: 10px; display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 45px; height: 45px; border-radius: 50%; background: #fff7ed; color: #c2410c; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.2rem;">R</div>
                    <div>
                        <p style="font-weight: bold; color: var(--admin-text-main); margin: 0;">Ravi Kumar</p>
                        <p style="font-size: 0.85rem; color: var(--admin-text-muted); margin: 0;">Your delivery partner</p>
                    </div>
                </div>
                <a href="tel:+919876543210" style="width: 40px; height: 40px; border-radius: 50%; background: #f97316; color: white; display: flex; align-items: center; justify-content: center; text-decoration: none; font-size: 1.2rem;">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width: 20px; height: 20px;"><path fill-rule="evenodd" d="M2 3.5A1.5 1.5 0 013.5 2h1.148a1.5 1.5 0 011.465 1.175l.716 3.223a1.5 1.5 0 01-1.052 1.767l-.933.267c-.41.117-.643.555-.48.95a11.542 11.542 0 006.254 6.254c.395.163.833-.07.95-.48l.267-.933a1.5 1.5 0 011.767-1.052l3.223.716A1.5 1.5 0 0118 15.352V16.5a1.5 1.5 0 01-1.5 1.5h-1.528a13.5 13.5 0 01-11.472-11.472H2A1.5 1.5 0 012 3.5z" clip-rule="evenodd"></path></svg>
                </a>
            </div>

            <div style="margin-top: 1.5rem; background: var(--admin-bg); padding: 1rem; border-radius: 10px;">
                <div style="display: flex; justify-content: space-between;">
                    <p><strong>Order #${safeId.toString().slice(-5)}</strong></p>
                    <button class="btn-edit-profile" style="position: static;" onclick="viewReceipt('${safeId}')">Details</button>
                </div>
                <p style="color: var(--admin-text-muted); font-size: 0.9rem; margin-bottom: 5px;">${itemsList}</p>
                <p style="font-weight: bold; font-size: 1.1rem; color: var(--admin-text-main);">Total: ₹${order.total} <span style="font-size: 0.8rem; font-weight: normal; color: var(--admin-text-muted); background: var(--admin-border); padding: 2px 6px; border-radius: 4px;">${order.paymentMethod}</span></p>
            </div>

            <div class="order-actions-row">
                ${order.status === 'Pending' ? `<button class="btn-outline" style="color: #e74c3c; border-color: #e74c3c;" onclick="cancelOrder('${safeId}')">Cancel Order</button>` : ''}
                <button class="btn-outline" onclick="showSystemToast('Support', 'Please call us at: +91 7366952957')">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width: 16px; height: 16px; margin-right: 6px; vertical-align: middle;">
                        <path fill-rule="evenodd" d="M2 3.5A1.5 1.5 0 013.5 2h1.148a1.5 1.5 0 011.465 1.175l.716 3.223a1.5 1.5 0 01-1.052 1.767l-.933.267c-.41.117-.643.555-.48.95a11.542 11.542 0 006.254 6.254c.395.163.833-.07.95-.48l.267-.933a1.5 1.5 0 011.767-1.052l3.223.716A1.5 1.5 0 0118 15.352V16.5a1.5 1.5 0 01-1.5 1.5h-1.528a13.5 13.5 0 01-11.472-11.472H2A1.5 1.5 0 012 3.5z" clip-rule="evenodd"></path>
                    </svg>
                    Call Support
                </button>
                ${order.status === 'Out for Delivery' ? `<button class="btn" style="padding: 8px 20px;" onclick="trackDelivery('${safeId}')">📍 Track Map</button>` : ''}
            </div>
            <p style="font-size: 11px; color: #888; text-align: center; margin-top: 8px;">You can cancel within 2 minutes of placing the order.</p>
        </div>
    `;
}

function generatePastOrderHTML(order) {
    console.log("Raw order object:", order);
    
    const safeId = order._id || order.id || '00000';
    const status = order.status || 'Pending';
    const statusClass = status.toLowerCase().replace(/ /g, '-');
    const isDelivered = status.toLowerCase() === 'completed';
    const items = Array.isArray(order.items) ? order.items : [];
    const itemsSummary = items.map(i => `${i.quantity || 1}x ${escapeHTML(i.name)}`).join(', ');

    const rawDate = order.createdAt || order.date || order.timestamp || order.placedAt;
    let displayDate = "Date unavailable";

    if (rawDate) {
      let d;
      if (rawDate?.toDate) { d = rawDate.toDate(); }
      else if (typeof rawDate === "number") { d = new Date(rawDate * 1000); }
      else { d = new Date(rawDate); }
      
      if (!isNaN(d)) {
        displayDate = d.toLocaleDateString("en-IN", {
          day: "numeric", month: "short", year: "numeric"
        });
      }
    }

    return `
        <div class="order-card" style="margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div style="flex: 1; min-width: 200px;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="background: var(--admin-bg); padding: 1rem; border-radius: 10px; font-size: 1.5rem;">🍲</div>
                    <div>
                        <h4 style="margin: 0; color: var(--admin-text-main);">Kajal Ki Rasoi</h4>
                        <p style="margin: 0; font-size: 0.8rem; color: var(--admin-text-muted);">${displayDate} &bull; Order #KKR${safeId.toString().slice(-5).toUpperCase()}</p>
                        <p style="margin: 0.2rem 0 0 0; font-weight: bold; color: var(--admin-text-main);">₹${order.total} &bull; <span class="status ${statusClass}" style="font-size: 0.75rem;">${status}</span></p>
                    </div>
                </div>
                <p style="margin: 0.8rem 0 0 0; font-size: 0.9rem; color: var(--admin-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 300px;">${itemsSummary}</p>
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.5rem; text-align: right;">
                ${isDelivered ? `<button class="btn" style="padding: 8px 15px; display: inline-flex; align-items: center; justify-content: center;" onclick='reorderItems(${JSON.stringify(items).replace(/'/g, "&#39;")})'>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px; margin-right: 6px;">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg> Reorder
                </button>` : ''}
                <button class="btn-outline" style="padding: 6px 12px; font-size: 0.85rem;" onclick="viewReceipt('${safeId}')">View Details</button>
                ${isDelivered ? `<button class="btn-outline" style="padding: 6px 12px; font-size: 0.85rem; color: #f39c12; border-color: #f39c12;" onclick="showRatingModal('${safeId}')">⭐ Rate</button>` : ''}
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
            showSystemToast('Error', 'Session expired. Please log in again.', 'error');
            setTimeout(() => window.location.href = 'login.html', 2000);
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
                showSystemToast('Success', id ? 'Item updated successfully.' : 'Item added successfully.');
                loadAdminMenu();
            } else {
                const data = await res.json();
                showSystemToast('Error', data.message || 'Failed to save item.', 'error');
            }
        } catch (error) {
            showSystemToast('Error', 'Error connecting to server.', 'error');
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
            showSystemToast('Success', 'Menu item deleted.');
            loadAdminMenu();
        } else {
            const data = await res.json();
            showSystemToast('Error', data.message || 'Failed to delete item.', 'error');
        }
    } catch (error) {
        showSystemToast('Error', 'Error connecting to server.', 'error');
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
            showSystemToast('Error', data.message || 'Failed to update availability.', 'error');
        }
    } catch (error) {
        showSystemToast('Error', 'Error connecting to server.', 'error');
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
            showSystemToast('Error', data.message || 'Failed to update order status.', 'error');
        }
        // The WebSocket listener will automatically call loadAdminOrders() on success.
    } catch (error) {
        showSystemToast('Error', 'Error communicating with the server.', 'error');
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
            showSystemToast('Error', 'Failed to delete order.', 'error');
        }
    } catch (error) {
        showSystemToast('Error', 'Error communicating with the server.', 'error');
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
            showSystemToast('Success', 'Order cancelled successfully.');
            loadMyOrders();
        } else {
            showSystemToast('Error', data.message || 'Failed to cancel order.', 'error');
        }
    } catch (error) {
        showSystemToast('Error', 'Error communicating with the server.', 'error');
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
    showSystemToast('Success', 'Items added to cart!');
    setTimeout(() => { window.location.href = 'cart.html'; }, 1500);
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

    // Display total amount dynamically on the UI (also factors in item quantities properly)
    let baseTotal = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
    updatePaymentSummary(baseTotal, 0);

    const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
    const customerName = loggedInUser ? loggedInUser.name : '';
    const customerContact = loggedInUser ? loggedInUser.contact : '';

    const nameInput = document.getElementById('card-name');
    if (nameInput) nameInput.value = customerName;

    const guestContactSection = document.getElementById('guest-contact-section');
    const guestContactInput = document.getElementById('guest-contact');

    if (guestContactSection && guestContactInput) {
        if (loggedInUser) {
            guestContactSection.style.display = 'none'; // Hide the entire section
            guestContactInput.required = false; // Remove required attribute so the form can submit
        } else {
            // Ensure guest contact is required for guests if the section is visible
            guestContactInput.required = true;
        }
    }

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
    const codRadio = document.querySelector('input[value="cod"], input[value="COD"]');
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
                        const currentCodRadio = document.querySelector('input[value="cod"], input[value="COD"]');
                        if (currentCodRadio) {
                            currentCodRadio.disabled = true;
                            const onlineRadio = document.querySelector('input[value="online"], input[value="Online"]');
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

    // Add event listeners to update button text when payment method changes
    document.querySelectorAll('input[name="pay_method"]').forEach(radio => {
        radio.addEventListener('change', () => {
            let currentTotal = cart.reduce((sum, i) => sum + i.price * (i.quantity || 1), 0);
            let discount = (appliedCoupon === 'APNA50' && currentTotal >= 200) ? 50 : 0;
            updatePaymentSummary(currentTotal, discount);
        });
    });

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
        const payMethod = (document.querySelector('input[name="pay_method"]:checked')?.value || 'online').toLowerCase();
        if (payMethod === 'cod') {
            payBtn.innerText = `Confirm Order (₹${finalTotal} COD)`;
        } else {
            payBtn.innerText = `Pay ₹${finalTotal} Securely`;
        }
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
    const payMethod = (document.querySelector('input[name="pay_method"]:checked')?.value || 'online').toLowerCase();
    
    const flat = document.getElementById('address-flat')?.value.trim() || '';
    const area = document.getElementById('address-area')?.value.trim() || '';
    const landmark = document.getElementById('address-landmark')?.value.trim() || '';
    const city = document.getElementById('address-city')?.value.trim() || '';
    const pincode = document.getElementById('address-pincode')?.value.trim() || '';
    
    if (!customerName) {
        document.getElementById('payment-message').textContent = 'Please tell us your name.';
        return;
    }
    // Only validate guest contact if the user is not logged in
    const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
    if (!loggedInUser && !guestContact) {
        document.getElementById('payment-message').textContent = 'Please provide your contact information to proceed.';
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
        contact: loggedInUser ? savedContactStr : guestContact,
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
    const contact = document.getElementById('reg-contact').value.trim();
    const password = document.getElementById('reg-password').value;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^(?:\+91[\-\s]?)?\d{10}$/;
    if (!emailRegex.test(contact) && !phoneRegex.test(contact)) {
        showSystemToast('Error', 'Please enter a valid email address or a 10-digit phone number.', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, contact, password })
        });
        const data = await response.json();

        if (response.ok) {
            showSystemToast('Success', 'Account created successfully! Redirecting...');
            setTimeout(() => { window.location.href = 'login.html'; }, 1500);
        } else {
            showSystemToast('Error', data.message || 'Registration failed.', 'error');
        }
    } catch (error) {
        console.error('Registration Error:', error);
        showSystemToast('Error', 'Network Error: Could not connect to the server.', 'error');
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const contact = document.getElementById('login-contact').value.trim();
    const password = document.getElementById('login-password').value;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^(?:\+91[\-\s]?)?\d{10}$/;
    if (!emailRegex.test(contact) && !phoneRegex.test(contact)) {
        showSystemToast('Error', 'Please enter a valid email address or a 10-digit phone number.', 'error');
        return;
    }

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
            
            const capitalizedName = data.user.name.charAt(0).toUpperCase() + data.user.name.slice(1);
            showSystemToast(`Welcome back, <span style="color: #f97316; font-weight: 500;">${escapeHTML(capitalizedName)}!</span>`, 'Ready to order something delicious?');
            setTimeout(() => {
                if (data.user.role === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'index.html'; 
                }
            }, 1000);
        } else {
            showSystemToast('Error', data.message || 'Invalid credentials.', 'error');
        }
    } catch (error) {
        console.error('Login Error:', error);
        showSystemToast('Error', 'Network Error: Could not connect to the server.', 'error');
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
            
            const capitalizedName = data.user.name.charAt(0).toUpperCase() + data.user.name.slice(1);
            showSystemToast(`Welcome back, <span style="color: #f97316; font-weight: 500;">${escapeHTML(capitalizedName)}!</span>`, 'Ready to order something delicious?');
            setTimeout(() => { 
                if (data.user.role === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'index.html'; 
                }
            }, 1000);
        } else {
            showSystemToast('Error', data.message || 'Google Login failed.', 'error');
        }
    } catch (error) {
        showSystemToast('Error', 'Server error. Ensure the backend is running.', 'error');
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
                
                let btnWidth = container.offsetWidth || 340; // 340px is the approx inner width of our form container
                google.accounts.id.renderButton(
                    container,
                    { theme: 'outline', size: 'large', type: 'standard', width: btnWidth }
                );
            }
        }, 100);
    } catch (error) {
        console.error('Failed to load Google configuration.');
    }
}

function showForgotPasswordModal(event) {
    if (event) event.preventDefault();
    const overlay = document.createElement('div');
    overlay.id = 'custom-alert-page';
    
    const content = document.createElement('div');
    content.className = 'custom-alert-box';
    content.style.textAlign = 'left';
    
    content.innerHTML = `
        <h3 style="margin-bottom: 1rem; color: #2c3e50; text-align: center;">Reset Password</h3>
        <p style="color: #666; font-size: 0.9rem; margin-bottom: 1.5rem; text-align: center;">Enter the email address associated with your account, and we'll send you a secure link to reset your password.</p>
        <form id="forgot-password-form" style="display: flex; flex-direction: column; gap: 1rem;">
            <div>
                <input type="email" id="fp-email" required style="width: 100%; padding: 12px; border: 1px solid #ccc; border-radius: 8px; font-size: 1rem;" placeholder="e.g. rahul@example.com">
            </div>
            <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
                <button type="submit" class="btn" style="flex: 1; border-radius: 8px;">Send Reset Link</button>
                <button type="button" class="btn" style="flex: 1; background-color: #f1f2f6; color: #333; border-radius: 8px;" onclick="document.body.removeChild(this.closest('#custom-alert-page'))">Cancel</button>
            </div>
        </form>
    `;
    
    overlay.appendChild(content);
    document.body.appendChild(overlay);
    
    document.getElementById('forgot-password-form').onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('fp-email').value;
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerText = 'Sending...';
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await response.json();
            document.body.removeChild(overlay);
            if (response.ok || data.success) {
                showSystemToast('Success', data.message);
            } else {
                showSystemToast('Error', data.message || 'Error processing request.', 'error');
            }
        } catch (error) {
            submitBtn.disabled = false;
            submitBtn.innerText = 'Send Reset Link';
            showSystemToast('Error', 'Error connecting to the server.', 'error');
        }
    };
}

function updateAuthNav() {
    const loggedInUserStr = localStorage.getItem('loggedInUser');
    const loggedInUser = loggedInUserStr ? JSON.parse(loggedInUserStr) : null;
    const navLinks = document.querySelector('.nav-links');
    const navRight = document.querySelector('.nav-right');
    
    if (!navLinks) return;

    // Hide or show cart links globally based on login status
    const cartLinks = document.querySelectorAll('a[href="cart.html"]');
    cartLinks.forEach(link => {
        if (loggedInUser) {
            if (link.parentElement.tagName === 'LI') link.parentElement.style.display = 'inline-flex';
            else link.style.display = 'inline-flex';
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

    const existingAvatar = document.querySelector('.nav-right > div[data-avatar="true"]');
    if (existingAvatar) existingAvatar.remove();

    if (loggedInUser) {
        // Add avatar circle and dropdown
        const initial = loggedInUser.name ? loggedInUser.name.charAt(0).toUpperCase() : 'U';
        
        const avatarContainer = document.createElement('div');
        avatarContainer.dataset.avatar = "true";
        avatarContainer.style.position = 'relative';
        
        const avatarCircle = document.createElement('div');
        avatarCircle.style.width = '30px';
        avatarCircle.style.height = '30px';
        avatarCircle.style.borderRadius = '50%';
        avatarCircle.style.background = '#fff7ed';
        avatarCircle.style.color = '#c2410c';
        avatarCircle.style.fontSize = '12px';
        avatarCircle.style.border = '1.5px solid #fed7aa';
        avatarCircle.style.display = 'flex';
        avatarCircle.style.alignItems = 'center';
        avatarCircle.style.justifyContent = 'center';
        avatarCircle.style.fontWeight = 'bold';
        avatarCircle.style.cursor = 'pointer';
        avatarCircle.innerText = initial;
        
        const dropdown = document.createElement('div');
        dropdown.style.position = 'absolute';
        dropdown.style.top = '120%';
        dropdown.style.right = '0';
        dropdown.style.background = '#fff';
        dropdown.style.borderRadius = '8px';
        dropdown.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)';
        dropdown.style.padding = '8px 0';
        dropdown.style.minWidth = '150px';
        dropdown.style.display = 'none';
        dropdown.style.flexDirection = 'column';
        dropdown.style.zIndex = '1001';
        
        const createDropLink = (text, href, onClick) => {
            const a = document.createElement('a');
            a.innerText = text;
            a.href = href;
            a.style.padding = '10px 20px';
            a.style.color = '#333';
            a.style.textDecoration = 'none';
            a.style.fontSize = '14px';
            a.style.fontFamily = "'DM Sans', sans-serif";
            a.style.display = 'block';
            a.onmouseover = () => a.style.background = '#f9f9f9';
            a.onmouseout = () => a.style.background = 'transparent';
            if (onClick) {
                a.onclick = (e) => { e.preventDefault(); onClick(); };
            }
            return a;
        };
        
        dropdown.appendChild(createDropLink('My Orders', 'my-orders.html'));
        dropdown.appendChild(createDropLink('Profile', 'profile.html'));
        dropdown.appendChild(createDropLink('Logout', '#', handleLogout));
        
        avatarCircle.onclick = (e) => {
            e.stopPropagation();
            dropdown.style.display = dropdown.style.display === 'none' ? 'flex' : 'none';
        };
        
        document.addEventListener('click', () => {
            dropdown.style.display = 'none';
        });
        
        avatarContainer.appendChild(avatarCircle);
        avatarContainer.appendChild(dropdown);
        
        const menuToggle = document.getElementById('mobile-menu');
        if (menuToggle && navRight) {
            navRight.insertBefore(avatarContainer, menuToggle);
        } else if (navRight) {
            navRight.appendChild(avatarContainer);
        }
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
            showSystemToast('Success', data.message || 'Thank you for your feedback!');
            loadMyOrders();
        } else {
            showSystemToast('Error', data.message || 'Could not submit review.', 'error');
        }
    } catch (error) {
        showSystemToast('Error', 'Error communicating with the server.', 'error');
    }
}

async function loadProfile() {
    const token = localStorage.getItem('authToken');
    try {
        const response = await fetch(`${API_BASE_URL}/api/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.status === 401 || response.status === 403) {
            showSystemToast('Error', 'Session expired. Please log in again.', 'error');
            setTimeout(() => { window.location.href = 'login.html'; }, 2000);
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
        showSystemToast('Error', 'Error fetching profile.', 'error');
    }
}

function repeatLastOrder() {
    const lastOrderNameEl = document.getElementById('last-order-name');
    if (!lastOrderNameEl || !lastOrderNameEl.dataset.items) {
        showSystemToast('Info', "You have no past orders to repeat yet!");
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
        
        showSystemToast('Success', "Items from your last order have been added to the cart!");
        setTimeout(() => { window.location.href = 'cart.html'; }, 1500);
    } catch(e) {
        showSystemToast('Error', "Could not process repeat order.", 'error');
    }
}

function handleLogout() {
    localStorage.removeItem('loggedInUser');
    localStorage.removeItem('authToken');
    localStorage.removeItem('cart'); // Clear cart on logout
    showSystemToast('Success', 'You have been successfully logged out.');
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
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
    const contact = document.getElementById('profile-contact').value.trim();
    const password = document.getElementById('profile-password').value;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^(?:\+91[\-\s]?)?\d{10}$/;
    if (!emailRegex.test(contact) && !phoneRegex.test(contact)) {
        showSystemToast('Error', 'Please enter a valid email address or a 10-digit phone number.', 'error');
        return;
    }

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
            showSystemToast('Success', 'Profile updated successfully!');
            setTimeout(() => window.location.reload(), 1500);
        } else {
            showSystemToast('Error', data.message || 'Failed to update profile.', 'error');
        }
    } catch (error) {
        showSystemToast('Error', 'Error updating profile.', 'error');
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
            showSystemToast('Error', data.message || 'Could not fetch receipt.', 'error');
        }
    } catch (error) {
        showSystemToast('Error', 'Error communicating with server.', 'error');
    }
}

function showReceiptModal(order) {
    const overlay = document.createElement('div');
    overlay.id = 'custom-alert-page';

    const modalContent = document.createElement('div');
    modalContent.className = 'receipt-modal-content';

    const date = order.timestamp?.toDate?.() 
        ? order.timestamp.toDate() 
        : new Date(order.timestamp);

    const formattedDate = isNaN(date) ? 'Date unavailable' : 
        date.toLocaleDateString('en-IN', { 
            day: 'numeric', month: 'short', year: 'numeric' 
        });

    const itemsHtml = order.items.map(item => `
        <div class="receipt-item">
            <span>${escapeHTML(item.name)}</span>
            <span>₹${Number(item.price) || 0}</span>
        </div>
    `).join('');
    const displayAddress = escapeHTML(order.address || 'N/A').replace(/\n/g, '<br>');

    modalContent.innerHTML = `
        <h3>Kajal Ki Rasoi<br><span style="font-size: 0.9rem; font-weight: normal;">Order #${escapeHTML((order._id || order.id).toString().slice(-5))}</span></h3>
        <p style="font-size: 0.85rem; text-align: center; margin-bottom: 0.5rem;">${formattedDate}</p>
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
                showSystemToast('Success', data.message);
                setTimeout(() => window.location.reload(), 1500);
            } else { showSystemToast('Error', data.message || 'Failed to submit request.', 'error'); }
        } catch (err) { showSystemToast('Error', 'Network error connecting to server.', 'error'); }
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
            } else { showSystemToast('Error', data.error || 'Checkout failed.', 'error'); }
        } catch (err) { showSystemToast('Error', 'Payment error.', 'error'); }
    }
}