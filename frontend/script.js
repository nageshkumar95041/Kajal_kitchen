// Automatically adapt to production domain, or use localhost:3000 for local dev
const API_BASE_URL = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin;

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

document.addEventListener('DOMContentLoaded', () => {
    const navbar = document.getElementById('navbar');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    updateCartCount();
    
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
            loadAdminOrders();
            loadAdminMenu();
        }
    }

    if(window.location.pathname.includes('my-orders.html')) {
        let user = null;
        try { user = JSON.parse(localStorage.getItem('loggedInUser')); } catch(e) {}

        if (!user || !localStorage.getItem('authToken')) {
            window.location.href = 'login.html';
        } else {
            loadMyOrders();
        }
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
                loadAdminOrders();
            } else if(window.location.pathname.includes('my-orders.html')) {
                if (data && data.type === 'ORDER_COMPLETED') {
                    showCustomAlert('Your order is on the way!');
                }
                loadMyOrders();
            }
        });
    }
});

function orderItem(itemName, price) {
    if (!localStorage.getItem('loggedInUser')) {
        showCustomAlert('Please login or create an account to start ordering.', () => {
            window.location.href = 'login.html';
        });
        return;
    }

    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    cart.push({ name: itemName, price: price });
    localStorage.setItem('cart', JSON.stringify(cart));
    
    updateCartCount();
    showCustomAlert(`Great choice! ${itemName} has been added to your cart.`);
}

function updateCartCount() {
    const cartCountEl = document.getElementById('cart-count');
    if(cartCountEl) {
        let cart = JSON.parse(localStorage.getItem('cart')) || [];
        cartCountEl.innerText = cart.length;
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
        total += item.price;
        cartItemsContainer.innerHTML += `
            <div class="cart-item">
                <span>${escapeHTML(item.name)}</span>
                <span>
                    ₹${item.price}
                    <button onclick="removeFromCart(${index})" style="margin-left: 1rem; color: red; border: none; background: none; cursor: pointer; font-weight: bold;">&times; Remove</button>
                </span>
            </div>
        `;
    });
    cartTotalEl.innerText = `₹${total}`;
}

function removeFromCart(index) {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    cart.splice(index, 1);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    renderCart();
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
    if (!localStorage.getItem('loggedInUser')) {
        showCustomAlert('Please login to checkout.', () => {
            window.location.href = 'login.html';
        });
        return;
    }

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
async function loadAdminOrders() {
    const container = document.getElementById('admin-orders-container');
    if (!container) return;

    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/api/orders`, {
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
            const status = order.status || 'Preparing';
            const statusClass = status.toLowerCase().replace(' ', '-');
            const items = Array.isArray(order.items) ? order.items : [];
            const itemsList = items.map(i => `<li>${escapeHTML(i.name) || 'Item'} (₹${Number(i.price) || 0})</li>`).join('');

            return `
                <div class="order-card">
                    <div class="order-header">
                        <h3>Order #${escapeHTML(safeId.toString().slice(-5))}</h3>
                        <span class="status ${statusClass}">${status}</span>
                    </div>
                    <p><strong>Customer:</strong> ${escapeHTML(order.customerName) || 'Guest'}</p>
                    <p><strong>Time:</strong> ${escapeHTML(order.timestamp) || 'N/A'}</p>
                    <ul class="order-items-list">${itemsList}</ul>
                    <div class="order-footer">
                        <strong>Total: ₹${Number(order.total) || 0}</strong>
                        ${status !== 'Completed' 
                            ? `<button class="btn-order" onclick="completeOrder('${safeId}')">Mark Completed</button>` 
                            : `<button class="btn-order" style="background-color: #c0392b;" onclick="deleteOrder('${safeId}')">Delete</button>`
                        }
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = ordersHtml;
    } catch (error) {
        container.innerHTML = '<p class="empty-cart" style="color:red;">Error connecting to the backend server.</p>';
    }
}

async function loadMyOrders() {
    const container = document.getElementById('my-orders-container');
    if (!container) return;

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
            container.innerHTML = '<p class="empty-cart">You have no past orders.</p>';
            return;
        }

        const ordersHtml = orders.map(order => {
            const safeId = order._id || order.id || '00000';
            const status = order.status || 'Preparing';
            const statusClass = status.toLowerCase().replace(' ', '-');
            const items = Array.isArray(order.items) ? order.items : [];
            const itemsList = items.map(i => `<li>${escapeHTML(i.name) || 'Item'} (₹${Number(i.price) || 0})</li>`).join('');

            return `
                <div class="order-card">
                    <div class="order-header">
                        <h3>Order #${escapeHTML(safeId.toString().slice(-5))}</h3>
                        <span class="status ${statusClass}">${status}</span>
                    </div>
                    <p><strong>Time:</strong> ${escapeHTML(order.timestamp) || 'N/A'}</p>
                    <ul class="order-items-list">${itemsList}</ul>
                    <div class="order-footer">
                        <strong>Total: ₹${Number(order.total) || 0}</strong>
                        <div>
                            <button class="btn-order" style="background-color: #7f8c8d; margin-right: 5px;" onclick="viewReceipt('${safeId}')">Receipt</button>
                            ${status === 'Completed' ? `<button class="btn-order" onclick="trackDelivery('${safeId}')">Track</button>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = ordersHtml;
    } catch (error) {
        container.innerHTML = '<p class="empty-cart" style="color:red;">Error fetching your orders.</p>';
    }
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
            html += '<div style="overflow-x: auto;"><table style="width:100%; border-collapse: collapse; background: #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.05); border-radius: 5px; overflow: hidden; min-width: 600px;">';
            html += '<tr style="background: #2c3e50; color: #fff; text-align: left;"><th style="padding: 1rem;">Name</th><th style="padding: 1rem;">Price</th><th style="padding: 1rem;">Status</th><th style="padding: 1rem;">Actions</th></tr>';
            
            menuItems.forEach(item => {
                const isAvailable = item.available !== false;
                html += `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 1rem;">${escapeHTML(item.name)}</td>
                        <td style="padding: 1rem;">₹${item.price}</td>
                        <td style="padding: 1rem;"><span class="status ${isAvailable ? 'completed' : 'preparing'}">${isAvailable ? 'Available' : 'Sold Out'}</span></td>
                        <td style="padding: 1rem;">
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

function showMenuModal(item = null) {
    const overlay = document.createElement('div');
    overlay.id = 'custom-alert-page';
    const content = document.createElement('div');
    content.className = 'custom-alert-box';
    content.style.textAlign = 'left';
    
    const isEdit = !!item;
    content.innerHTML = `
        <h3 style="margin-bottom: 1rem; color: #2c3e50; text-align: center;">${isEdit ? 'Edit Menu Item' : 'Add New Item'}</h3>
        <form id="menu-form" style="display: flex; flex-direction: column; gap: 1rem;">
            <input type="hidden" id="menu-id" value="${isEdit ? item._id : ''}">
            <div>
                <label style="font-weight: bold; display: block; margin-bottom: 0.3rem;">Name</label>
                <input type="text" id="menu-name" value="${isEdit ? escapeHTML(item.name) : ''}" required style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
            </div>
            <div>
                <label style="font-weight: bold; display: block; margin-bottom: 0.3rem;">Price (₹)</label>
                <input type="number" id="menu-price" value="${isEdit ? item.price : ''}" required style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
            </div>
            <div>
                <label style="font-weight: bold; display: block; margin-bottom: 0.3rem;">Description</label>
                <textarea id="menu-desc" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; min-height: 60px;">${isEdit && item.description ? escapeHTML(item.description) : ''}</textarea>
            </div>
            <div>
                <label style="font-weight: bold; display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
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
    
    document.getElementById('menu-form').onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('menu-id').value;
        const payload = {
            name: document.getElementById('menu-name').value,
            price: Number(document.getElementById('menu-price').value),
            description: document.getElementById('menu-desc').value,
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

async function completeOrder(orderId) {
    const token = localStorage.getItem('authToken');
    try {
        const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}/complete`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
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

function trackDelivery(orderId) {
    // Dynamically inject Map library if it hasn't been loaded yet
    if (typeof L === 'undefined') {
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(css);

        const js = document.createElement('script');
        js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        js.onload = () => openMapModal(orderId);
        document.head.appendChild(js);
        return;
    }
    
    openMapModal(orderId);
}

function openMapModal(orderId) {
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
        .bindPopup('<b>Kajal Kitchen</b>').openPopup();

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
            setTimeout(() => showRatingModal(orderId), 2000); // Show rating after 2 seconds
        }
    }, 50); // 50ms per frame = 7.5 seconds animation duration
}

/* --- Stripe Payment Functions --- */
let stripe;
let elements;

async function initializePaymentPage() {
    try {
        const configRes = await fetch(`${API_BASE_URL}/api/config/stripe`);
        const { publishableKey } = await configRes.json();
        stripe = Stripe(publishableKey); 
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

    const token = localStorage.getItem('authToken');
    const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
    const customerName = loggedInUser ? loggedInUser.name : 'Customer';

    const nameInput = document.getElementById('card-name');
    if (nameInput) nameInput.value = customerName;

    const response = await fetch(`${API_BASE_URL}/api/create-payment-intent`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ items: cart, customerName: customerName }),
    });
    const { clientSecret, error } = await response.json();

    if (error) {
        document.getElementById('payment-message').textContent = error;
        return;
    }

    const appearance = {
        theme: 'stripe',
        variables: {
            colorPrimary: '#e67e22',
            fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
            borderRadius: '5px',
        },
    };
    elements = stripe.elements({ clientSecret, appearance });
    const paymentElement = elements.create('payment');
    paymentElement.mount('#payment-element');

    const form = document.getElementById('payment-form');
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        await processStripePayment();
    });
}

async function processStripePayment() {
    const customerName = document.getElementById('card-name').value;
    if (!customerName) {
        document.getElementById('payment-message').textContent = 'Please enter your name.';
        return;
    }

    document.getElementById('submit-payment-btn').disabled = true;

    const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required', // Prevents full-page redirects for cards, while allowing popups for Google/Apple Pay
        confirmParams: {
            payment_method_data: {
                billing_details: { name: customerName }
            }
        },
    });

    if (error) {
        document.getElementById('payment-message').textContent = error.message;
        document.getElementById('submit-payment-btn').disabled = false;
    } else if (paymentIntent.status === 'succeeded') {
        const token = localStorage.getItem('authToken');
        await fetch(`${API_BASE_URL}/api/confirm-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ paymentIntentId: paymentIntent.id })
        });

        showCustomAlert('Payment successful! Your order is being prepared.', () => {
            localStorage.removeItem('cart');
            window.location.href = 'my-orders.html';
        });
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
        showCustomAlert('Server error. Ensure the backend is running on port 3000.');
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
            
            showCustomAlert('Login successful!', () => { 
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
        showCustomAlert('Server error. Ensure the backend is running on port 3000.');
    }
}

function updateAuthNav() {
    const loggedInUser = localStorage.getItem('loggedInUser');
    const navLinks = document.querySelector('.nav-links');
    
    if (loggedInUser && navLinks) {
        // Dynamically inject the My Orders link so we don't have to edit every HTML file manually
        if (!navLinks.querySelector('a[href="my-orders.html"]')) {
            const myOrdersLi = document.createElement('li');
            myOrdersLi.innerHTML = '<a href="my-orders.html">My Orders</a>';
            const loginLink = Array.from(navLinks.querySelectorAll('a')).find(a => a.textContent.includes('Login'));
            navLinks.insertBefore(myOrdersLi, loginLink ? loginLink.parentElement : null);
        }

        if (!navLinks.querySelector('a[href="profile.html"]')) {
            const profileLi = document.createElement('li');
            profileLi.innerHTML = '<a href="profile.html">Profile</a>';
            const loginLink = Array.from(navLinks.querySelectorAll('a')).find(a => a.textContent.includes('Login'));
            navLinks.insertBefore(profileLi, loginLink ? loginLink.parentElement : null);
        }

        const links = navLinks.querySelectorAll('a');
        links.forEach(link => {
            if (link.textContent.includes('Login')) {
                link.textContent = 'Logout';
                link.href = '#';
                link.onclick = (e) => {
                    e.preventDefault();
                    localStorage.removeItem('loggedInUser');
                    localStorage.removeItem('authToken');
                    window.location.href = 'index.html';
                };
            }
            if (link.textContent.includes('Sign Up')) {
                link.parentElement.style.display = 'none';
            }
        });
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
            showCustomAlert(data.message || 'Thank you for your feedback!');
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
            document.getElementById('profile-name').value = data.user.name;
            document.getElementById('profile-contact').value = data.user.contact;
        }
    } catch (error) {
        showCustomAlert('Error fetching profile.');
    }
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

    modalContent.innerHTML = `
        <h3>Kajal Kitchen<br><span style="font-size: 0.9rem; font-weight: normal;">Order #${escapeHTML((order._id || order.id).toString().slice(-5))}</span></h3>
        <p style="font-size: 0.85rem; text-align: center; margin-bottom: 1.5rem;">${escapeHTML(order.timestamp)}</p>
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