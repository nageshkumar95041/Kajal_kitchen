const express = require('express');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const Stripe = require('stripe');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Trust the first proxy (Required for rate limiting behind hosts like Render, Railway, or Vercel)
app.set('trust proxy', 1);

app.use(helmet()); // Sets robust HTTP security headers (Clickjacking, XSS protection, etc.)

app.post('/webhook', express.raw({type: 'application/json'}), handleStripeWebhook);

// Restrict CORS strictly for Production
const corsOptions = {
    origin: process.env.FRONTEND_URL || "*", // Define FRONTEND_URL in .env in production!
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions)); // Must be after webhook endpoint
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global API Rate Limiter (Protects against generic DDoS / Spam)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Limit each IP to 200 requests per `window`
    message: { success: false, message: 'Too many requests, please try again later.' }
});

// Strict Auth Rate Limiter (Protects against Brute Force Login/Signup)
const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 Hour
    max: 15, // Limit each IP to 15 login/register requests per hour
    message: { success: false, message: 'Too many authentication attempts, please try again later.' }
});

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: corsOptions
});

const SECRET_KEY = process.env.JWT_SECRET;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

if (!SECRET_KEY || !EMAIL_USER || !EMAIL_PASS || !GOOGLE_CLIENT_ID || !STRIPE_SECRET_KEY || !STRIPE_PUBLISHABLE_KEY) {
    console.error("FATAL ERROR: A required secret is not defined in .env file.");
    process.exit(1);
}

const stripe = Stripe(STRIPE_SECRET_KEY);
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// MongoDB Connection (Online / MongoDB Atlas)
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('Connected to MongoDB Database');
        seedAdmin();
        seedMenu();
    })
    .catch(err => console.error('MongoDB connection error:', err));

// Mongoose Schemas & Models
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    contact: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true }, // In a real app, hash this with bcrypt!
    role: { type: String, default: 'user' }
}, { toJSON: { virtuals: true } });
const User = mongoose.model('User', userSchema);

const orderSchema = new mongoose.Schema({
    userId: { type: String, index: true }, // Indexed for faster user order history
    customerName: { type: String, required: true },
    contact: { type: String },
    address: { type: String, required: true },
    items: { type: Array, required: true },
    total: { type: Number, required: true },
    paymentMethod: { type: String, default: 'Online', enum: ['Online', 'COD'] },
    status: { type: String, default: 'Pending', enum: ['Pending', 'Preparing', 'Out for Delivery', 'Completed', 'Rejected', 'Cancelled'], index: true },
    timestamp: { type: Date, default: Date.now, index: true },
    rating: { type: Number },
    review: { type: String }
}, { toJSON: { virtuals: true } });
const Order = mongoose.model('Order', orderSchema);

const subscriptionSchema = new mongoose.Schema({
    userId: { type: String, index: true },
    customerName: { type: String, required: true },
    contact: { type: String, required: true },
    address: { type: String, required: true },
    plan: { type: String, required: true },
    frequency: { type: Number, required: true }, // e.g., 5 or 7 days, or 7 for Trial
    persons: { type: Number, default: 1 },
    couponCode: { type: String },
    price: { type: Number, required: true },
    startDate: { type: Date, required: true },
    status: { type: String, default: 'Pending', index: true },
    timestamp: { type: Date, default: Date.now }
});
const Subscription = mongoose.model('Subscription', subscriptionSchema);

const cartSchema = new mongoose.Schema({
    stripeSessionId: { type: String, required: true, index: true },
    userId: { type: String }, // Optional
    customerName: { type: String, required: true },
    contact: { type: String },
    address: { type: String, required: true },
    cart: { type: Object, required: true }
});
const TempCart = mongoose.model('TempCart', cartSchema);

const tempSubscriptionSchema = new mongoose.Schema({
    stripeSessionId: { type: String, required: true, index: true },
    userId: { type: String },
    customerName: { type: String, required: true },
    contact: { type: String, required: true },
    address: { type: String, required: true },
    plan: { type: String, required: true },
    frequency: { type: Number, required: true },
    persons: { type: Number, default: 1 },
    couponCode: { type: String },
    price: { type: Number, required: true },
    startDate: { type: Date, required: true }
});
const TempSubscription = mongoose.model('TempSubscription', tempSubscriptionSchema);

const menuItemSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    price: { type: Number, required: true },
    description: { type: String },
    category: { type: String, default: '🍲 Main Course', index: true },
    imageUrl: { type: String },
    available: { type: Boolean, default: true }
});
const MenuItem = mongoose.model('MenuItem', menuItemSchema);

// Seed Default Admin
async function seedAdmin() {
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
    
    const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);
    
    await User.findOneAndUpdate(
        { role: 'admin' },
        { name: 'Restaurant Admin', contact: adminUsername.toLowerCase(), password: hashedAdminPassword },
        { upsert: true, new: true }
    );
    console.log(`Admin user verified/updated in Database with username: ${adminUsername}`);
}

// Seed Default Menu if Empty
async function seedMenu() {
    // Remove old fine-dining items to ensure the new homestyle menu takes effect
    const oldMenu = await MenuItem.findOne({ name: 'Truffle Pasta' });
    if (oldMenu) {
        await MenuItem.deleteMany({});
    }

    const count = await MenuItem.countDocuments();
    if (count < 10) {
        await MenuItem.deleteMany({});
        await MenuItem.insertMany([
            { name: 'Special Thali', price: 180, description: '4 Roti, Rice, Seasonal Sabzi, Dal Tadka, and fresh Salad.', category: "🌟 Today's Special" },
            { name: 'Gajar Ka Halwa', price: 100, description: 'Traditional winter dessert made with grated carrots, milk, and nuts.', category: "🌟 Today's Special" },
            { name: 'Poori Sabji', price: 100, description: '4 fluffy pooris served with spicy potato curry.', category: "🌟 Today's Special" },
            { name: 'Baigan Masala', price: 120, description: 'Eggplant cooked in a tangy, spicy peanut and coconut gravy.', category: "🌟 Today's Special" },
            { name: 'Budget Meal (₹99)', price: 99, description: '3 Roti, Dal, Dry Sabzi, and Pickle.', category: "💰 Budget Meals" },
            { name: 'Budget Meal (₹149)', price: 149, description: '3 Roti, Rice, Dal Makhani, Mix Veg, and Curd.', category: "💰 Budget Meals" },
            { name: 'Dal + Rice Combo', price: 149, description: 'Comforting yellow Dal Tadka served with Jeera Rice and salad.', category: "🍱 Value Combos" },
            { name: 'Paneer + 2 Naan Combo', price: 199, description: 'Rich Paneer Butter Masala served with 2 Butter Naan.', category: "🍱 Value Combos" },
            { name: 'Dal Tadka', price: 120, description: 'Yellow lentils cooked with onions, tomatoes and garlic.', category: "🍲 Main Course" },
            { name: 'Dal Makhani', price: 160, description: 'Slow-cooked black lentils in a rich, creamy sauce.', category: "🍲 Main Course" },
            { name: 'Shahi Paneer', price: 220, description: 'Soft paneer cubes in a thick, creamy nut-based gravy.', category: "🍲 Main Course" },
            { name: 'Kadai Paneer', price: 200, description: 'Paneer tossed with bell peppers and onions in a spicy masala.', category: "🍲 Main Course" },
            { name: 'Paneer Butter Masala', price: 210, description: 'Paneer cooked in a rich and creamy tomato and butter gravy.', category: "🍲 Main Course" },
            { name: 'Palak Paneer', price: 190, description: 'Nutritious spinach gravy with soft paneer cubes.', category: "🍲 Main Course" },
            { name: 'Mix Veg', price: 140, description: 'Assorted seasonal vegetables cooked with aromatic spices.', category: "🍲 Main Course" },
            { name: 'Aloo Gobi', price: 130, description: 'Classic homestyle potato and cauliflower stir-fry.', category: "🍲 Main Course" },
            { name: 'Bhindi Masala', price: 130, description: 'Okra cooked with onions and a blend of ground spices.', category: "🍲 Main Course" },
            { name: 'Chole Masala', price: 140, description: 'Spicy homemade chickpea curry.', category: "🍲 Main Course" },
            { name: 'Rajma', price: 130, description: 'Comforting, slow-cooked red kidney beans gravy.', category: "🍲 Main Course" },
            { name: 'Roti / Chapati', price: 15, description: 'Whole wheat flatbread.', category: "🥖 Breads & Parathas" },
            { name: 'Butter Roti', price: 20, description: 'Whole wheat flatbread brushed with butter.', category: "🥖 Breads & Parathas" },
            { name: 'Tandoori Roti', price: 25, description: 'Crispy whole wheat bread baked in a clay oven.', category: "🥖 Breads & Parathas" },
            { name: 'Plain Naan', price: 35, description: 'Soft and fluffy leavened bread.', category: "🥖 Breads & Parathas" },
            { name: 'Butter Naan', price: 45, description: 'Soft naan brushed with generous butter.', category: "🥖 Breads & Parathas" },
            { name: 'Garlic Naan', price: 55, description: 'Naan topped with minced garlic and cilantro.', category: "🥖 Breads & Parathas" },
            { name: 'Lachha Paratha', price: 40, description: 'Multi-layered, flaky whole wheat bread.', category: "🥖 Breads & Parathas" },
            { name: 'Aloo Paratha', price: 50, description: 'Whole wheat flatbread stuffed with spiced potatoes.', category: "🥖 Breads & Parathas" },
            { name: 'Paneer Paratha', price: 70, description: 'Whole wheat flatbread stuffed with spiced grated paneer.', category: "🥖 Breads & Parathas" },
            { name: 'Plain Rice', price: 80, description: 'Steamed basmati rice.', category: "🍚 Rice & Biryani" },
            { name: 'Jeera Rice', price: 100, description: 'Basmati rice tempered with cumin seeds.', category: "🍚 Rice & Biryani" },
            { name: 'Veg Pulao', price: 140, description: 'Fragrant rice cooked with mixed vegetables.', category: "🍚 Rice & Biryani" },
            { name: 'Veg Biryani', price: 180, description: 'Aromatic layered rice and vegetable dish cooked with spices.', category: "🍚 Rice & Biryani" },
            { name: 'French Fries', price: 80, description: 'Crispy, golden potato fries.', category: "🥗 Extras & Desserts" },
            { name: 'Green Salad', price: 60, description: 'Fresh cucumber, tomatoes, carrots, and onions.', category: "🥗 Extras & Desserts" },
            { name: 'Onion Salad', price: 40, description: 'Sliced onions with green chilies and lemon.', category: "🥗 Extras & Desserts" },
            { name: 'Boondi Raita', price: 70, description: 'Yogurt mixed with crispy gram flour pearls and spices.', category: "🥗 Extras & Desserts" },
            { name: 'Plain Curd', price: 40, description: 'Fresh, homemade yogurt.', category: "🥗 Extras & Desserts" }
        ]);
        console.log('Expanded Indian homestyle menu items seeded to database.');
    }
}

// Nodemailer Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
    },
});


function authenticateAdmin(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err || decoded.role !== 'admin') return res.status(403).json({ success: false, message: 'Forbidden. Admins only.' });
        req.user = decoded;
        next();
    });
}

function authenticateUser(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Access denied. Please log in.' });

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(403).json({ success: false, message: 'Invalid or expired token.' });
        req.user = decoded;
        next();
    });
}

function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
        jwt.verify(token, SECRET_KEY, (err, decoded) => {
            if (!err) req.user = decoded;
            next();
        });
    } else {
        next();
    }
}

app.get('/api/config/stripe', (req, res) => {
    res.json({ publishableKey: STRIPE_PUBLISHABLE_KEY });
});

app.get('/api/config/google', (req, res) => {
    res.json({ clientId: GOOGLE_CLIENT_ID });
});

app.use('/api/', apiLimiter); // Apply general rate limit to all /api/ routes

// Simple In-Memory Cache for the highly-accessed Menu
let menuCache = { data: null, lastFetch: 0 };
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

app.get('/api/menu', async (req, res) => {
    const now = Date.now();
    if (menuCache.data && (now - menuCache.lastFetch < CACHE_TTL)) {
        return res.json(menuCache.data);
    }
    const menu = await MenuItem.find().lean(); // .lean() strips heavy mongoose wrappers
    menuCache = { data: menu, lastFetch: now };
    res.json(menu);
});

app.get('/api/admin/menu', authenticateAdmin, async (req, res) => {
    try {
        const menu = await MenuItem.find().lean();
        res.json(menu);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch menu items.' });
    }
});

app.post('/api/menu', authenticateAdmin, async (req, res) => {
    try {
        const { name, price, description, category, imageUrl, available } = req.body;
        if (!name || typeof price !== 'number') {
            return res.status(400).json({ success: false, message: 'A valid name and price are required.' });
        }
        const newItem = await MenuItem.create({ name, price, description, category, imageUrl, available });
        menuCache.data = null; // Clear cache on change
        res.status(201).json({ success: true, item: newItem });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to create menu item. Ensure the name is unique.' });
    }
});

app.put('/api/menu/:id', authenticateAdmin, async (req, res) => {
    try {
        // Prevent Mass Assignment by explicitly defining allowed fields
        const { name, price, description, category, imageUrl, available } = req.body;
        const updateData = { name, price, description, category, imageUrl, available };
        // Strip undefined fields so we don't accidentally wipe existing data
        Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);
        
        const updatedItem = await MenuItem.findByIdAndUpdate(req.params.id, updateData, { new: true });
        menuCache.data = null; // Clear cache on change
        res.json({ success: true, item: updatedItem });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update menu item.' });
    }
});

app.delete('/api/menu/:id', authenticateAdmin, async (req, res) => {
    try {
        await MenuItem.findByIdAndDelete(req.params.id);
        menuCache.data = null; // Clear cache on change
        res.json({ success: true, message: 'Menu item deleted.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete menu item.' });
    }
});

app.get('/api/admin/dashboard-stats', authenticateAdmin, async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const startOfWeek = new Date(today);
        startOfWeek.setDate(startOfWeek.getDate() - today.getDay());

        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        const revenueStats = await Order.aggregate([
            { $match: { status: 'Completed' } },
            {
                $facet: {
                    today: [
                        { $match: { timestamp: { $gte: today } } },
                        { $group: { _id: null, total: { $sum: '$total' } } }
                    ],
                    week: [
                        { $match: { timestamp: { $gte: startOfWeek } } },
                        { $group: { _id: null, total: { $sum: '$total' } } }
                    ],
                    month: [
                        { $match: { timestamp: { $gte: startOfMonth } } },
                        { $group: { _id: null, total: { $sum: '$total' } } }
                    ]
                }
            }
        ]);

        const orderCounts = await Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);

        const topItems = await Order.aggregate([
            { $match: { status: { $in: ['Preparing', 'Out for Delivery', 'Completed'] } } },
            { $unwind: '$items' },
            { $group: { _id: '$items.name', count: { $sum: '$items.quantity' } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);

        const revenue = {
            today: revenueStats[0].today[0]?.total || 0,
            week: revenueStats[0].week[0]?.total || 0,
            month: revenueStats[0].month[0]?.total || 0,
        };

        res.json({ success: true, revenue, orderCounts, topItems });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ success: false, message: 'Error fetching dashboard stats.' });
    }
});

app.post('/api/create-stripe-checkout', optionalAuth, async (req, res) => {
    const { items, customerName, contact, address, successUrl, cancelUrl, couponCode } = req.body;
    if (!Array.isArray(items)) {
        return res.status(400).json({ error: 'Invalid cart data' });
    }
    if (!address || typeof address !== 'string' || address.trim() === '') {
        return res.status(400).json({ error: 'Delivery address is required' });
    }

    // Fetch current prices from the database securely
    const itemNames = items.map(i => String(i.name));
    const dbItems = await MenuItem.find({ name: { $in: itemNames } });
    const priceMap = {};
    dbItems.forEach(item => { priceMap[item.name] = item.price; });

    let total = items.reduce((sum, item) => {
        const price = priceMap[String(item.name)] || 0;
        const qty = item.quantity || 1;
        return sum + (price * qty);
    }, 0);

    if (couponCode === 'APNA50' && total >= 200) total -= 50;
    if (total > 0 && total < 199) total += 40; // Delivery fee

    if (total === 0) {
        return res.status(400).json({ error: 'Cannot process an empty cart.' });
    }

    const safeName = customerName && customerName.trim() ? customerName.trim() : 'Guest';

    try {
        const frontendUrl = process.env.FRONTEND_URL || req.headers.origin || 'http://localhost:3000';
        
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'inr',
                    product_data: {
                        name: 'Kajal Ki Rasoi Order',
                    },
                    unit_amount: Math.round(total * 100),
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: (successUrl && successUrl.startsWith('http')) ? successUrl : `${frontendUrl}/my-orders.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: (cancelUrl && cancelUrl.startsWith('http')) ? cancelUrl : `${frontendUrl}/payment.html`,
            customer_email: contact && contact.includes('@') ? contact : undefined
        });

        await TempCart.create({
            stripeSessionId: session.id,
            userId: req.user ? req.user.id : null,
            customerName: safeName,
            contact: contact,
            address: address.trim(),
            cart: { items, total }
        });

        res.json({ id: session.id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || 'Failed to create Stripe checkout session' });
    }
});

app.post('/api/create-stripe-subscription-checkout', optionalAuth, async (req, res) => {
    const { plan, frequency, price, customerName, contact, address, startDate, persons, couponCode, successUrl, cancelUrl } = req.body;
    
    if (!plan || !customerName || !address || !startDate || !price) {
        return res.status(400).json({ error: 'Missing required subscription details.' });
    }

    try {
        const frontendUrl = process.env.FRONTEND_URL || (req.headers.origin && req.headers.origin !== 'null' ? req.headers.origin : 'http://localhost:3000');
        
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'inr',
                    product_data: {
                        name: `Subscription: ${plan} (${frequency === 7 && plan.includes('Trial') ? '7-Day Trial' : frequency + ' Days/Week'})`,
                        description: `For ${persons} Person(s). Start Date: ${new Date(startDate).toLocaleDateString('en-IN')}`
                    },
                    unit_amount: Math.round(price * 100),
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: (successUrl && successUrl.startsWith('http')) ? successUrl : `${frontendUrl}/subscription.html?sub_success=true`,
            cancel_url: (cancelUrl && cancelUrl.startsWith('http')) ? cancelUrl : `${frontendUrl}/subscription.html`,
            customer_email: contact && contact.includes('@') ? contact : undefined
        });

        await TempSubscription.create({
            stripeSessionId: session.id,
            userId: req.user ? req.user.id : null,
            customerName, contact, address, plan, frequency, persons, couponCode, price,
            startDate: new Date(startDate)
        });

        res.json({ id: session.id });
    } catch (error) {
        console.error('Subscription Stripe Error:', error);
        res.status(500).json({ error: error.message || 'Failed to create Stripe checkout session' });
    }
});

app.post('/api/subscribe', optionalAuth, async (req, res) => {
    const { plan, frequency, price, customerName, contact, address, startDate, persons, couponCode } = req.body;
    
    if (!plan || !customerName || !contact || !address || !startDate) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    try {
        const newSubscription = await Subscription.create({
            userId: req.user ? req.user.id : null,
            customerName, contact, address, plan, frequency, price,
            persons: persons || 1,
            couponCode,
            startDate: new Date(startDate)
        });

        res.status(201).json({ success: true, message: 'Subscription requested successfully! Our team will contact you shortly to confirm.' });
    } catch (error) {
        console.error('Subscription error:', error);
        res.status(500).json({ success: false, message: 'Failed to process subscription request.' });
    }
});

app.post('/api/checkout-cod', optionalAuth, async (req, res) => {
    const { items, customerName, contact, address, couponCode } = req.body;
    if (!Array.isArray(items) || !address || !customerName) return res.status(400).json({ error: 'Missing details' });

    const itemNames = items.map(i => String(i.name));
    const dbItems = await MenuItem.find({ name: { $in: itemNames } });
    const priceMap = {};
    dbItems.forEach(item => { priceMap[item.name] = item.price; });

    let total = items.reduce((sum, item) => sum + ((priceMap[item.name] || 0) * (item.quantity || 1)), 0);
    if (couponCode === 'APNA50' && total >= 200) total -= 50;
    if (total > 0 && total < 199) total += 40; 

    const newOrder = await Order.create({
        userId: req.user ? req.user.id : null,
        customerName: customerName.trim(),
        contact: contact,
        address: address.trim(),
        items: items,
        total: total,
        paymentMethod: 'COD'
    });
    
    io.emit('orderUpdate', { type: 'NEW_ORDER' });
    res.json({ success: true, orderId: newOrder._id });
});

app.get('/api/orders', authenticateAdmin, async (req, res) => {
    const { limit = 50, status, paymentMethod, date, contact } = req.query;
    
    const query = {};
    if (status && status !== 'all') {
        query.status = status;
    } else if (!status && !contact) { // Default to live orders for the main feed, but not for customer history lookup
        query.status = { $nin: ['Completed', 'Rejected', 'Cancelled'] };
    }
    if (paymentMethod) query.paymentMethod = paymentMethod;
    if (contact) query.contact = contact;
    if (date) {
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);
        query.timestamp = { $gte: startDate, $lte: endDate };
    }

    const orders = await Order.find(query).sort({ timestamp: -1 }).limit(parseInt(limit)).lean();
    res.json(orders);
});

app.get('/api/admin/subscriptions', authenticateAdmin, async (req, res) => {
    const { status } = req.query;
    const query = status ? { status } : {};
    try {
        const subscriptions = await Subscription.find(query).sort({ timestamp: -1 }).lean();
        res.json({ success: true, subscriptions });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch subscriptions.' });
    }
});

app.put('/api/admin/subscriptions/:id/status', authenticateAdmin, async (req, res) => {
    const { status } = req.body;
    try {
        const sub = await Subscription.findByIdAndUpdate(req.params.id, { status }, { new: true });
        res.json({ success: true, sub });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update subscription status.' });
    }
});

app.get('/api/admin/customers', authenticateAdmin, async (req, res) => {
    try {
        const customers = await Order.aggregate([
            {
                $group: {
                    _id: "$contact",
                    name: { $first: "$customerName" },
                    orderCount: { $sum: 1 },
                    totalSpent: { $sum: "$total" },
                    lastOrderDate: { $max: "$timestamp" }
                }
            },
            { $match: { _id: { $ne: null, $ne: "" } } }, 
            { $sort: { orderCount: -1 } } // Show repeat/most valuable customers first
        ]);
        res.json({ success: true, customers });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch customers.' });
    }
});

app.get('/api/users', authenticateAdmin, async (req, res) => {
    try {
        const users = await User.find({}, '-password').lean(); // Excludes the password field from the results
        res.json(users);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch users.' });
    }
});

app.get('/api/my-orders', authenticateUser, async (req, res) => {
    // Fetch latest 20 user orders sorted by newest first
    const limit = parseInt(req.query.limit) || 20;
    const userOrders = await Order.find({ userId: req.user.id }).sort({ _id: -1 }).limit(limit).lean();
    res.json(userOrders);
});

app.post('/api/guest-orders', async (req, res) => {
    const { orderIds } = req.body;
    if (!Array.isArray(orderIds) || orderIds.length === 0) return res.json([]);
    const orders = await Order.find({ _id: { $in: orderIds } }).sort({ _id: -1 }).lean();
    res.json(orders);
});

app.get('/api/orders/:id', authenticateUser, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
        if (order.userId !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Unauthorized access.' });
        }
        res.json({ success: true, order });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch order details.' });
    }
});

app.put('/api/orders/:id/status', authenticateAdmin, async (req, res) => {
    const { status } = req.body;
    const validStatuses = ['Pending', 'Preparing', 'Out for Delivery', 'Completed', 'Rejected', 'Cancelled'];
    if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status provided.' });
    }
    try {
        const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
        if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
        
        io.emit('orderUpdate', { type: 'STATUS_UPDATE', orderId: order._id, status: order.status });
        res.json({ success: true, order });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update order status.' });
    }
});

app.put('/api/orders/:id/cancel', authenticateUser, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
        if (order.userId !== req.user.id) return res.status(403).json({ success: false, message: 'Unauthorized access.' });
        if (order.status !== 'Pending') return res.status(400).json({ success: false, message: 'Order has already been accepted and cannot be cancelled.' });

        order.status = 'Cancelled';
        await order.save();
        
        io.emit('orderUpdate', { type: 'STATUS_UPDATE', orderId: order._id, status: order.status });
        res.json({ success: true, message: 'Order cancelled successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to cancel order.' });
    }
});

app.delete('/api/orders/:id', authenticateAdmin, async (req, res) => {
    try {
        await Order.findByIdAndDelete(req.params.id);
        io.emit('orderUpdate', { type: 'ORDER_DELETED' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete order.' });
    }
});

app.post('/api/orders/:id/review', authenticateUser, async (req, res) => {
    const { rating, review } = req.body;
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
        if (order.userId !== req.user.id) return res.status(403).json({ success: false, message: 'Unauthorized access.' });
        
        order.rating = Number(rating);
        order.review = review;
        await order.save();
        res.json({ success: true, message: 'Thank you for your feedback!' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to submit review.' });
    }
});

async function handleStripeWebhook(req, res) {
    const secret = STRIPE_WEBHOOK_SECRET;
    let event;

    if (secret) {
        const signature = req.headers['stripe-signature'];
        try {
            event = stripe.webhooks.constructEvent(req.body, signature, secret);
        } catch (err) {
            console.error(`Webhook signature verification failed: ${err.message}`);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }
    } else {
        event = JSON.parse(req.body.toString('utf8'));
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        await processSuccessfulPayment(session.id);
    }
    res.send({ status: 'ok' });
}

async function processSuccessfulPayment(orderId) {
    // Atomically find AND delete to prevent duplicate orders if client & webhook hit at the exact same millisecond
    const tempCart = await TempCart.findOneAndDelete({ stripeSessionId: orderId });
    if (tempCart) {
        const newOrder = await Order.create({
            userId: tempCart.userId,
            customerName: tempCart.customerName,
            contact: tempCart.contact,
            address: tempCart.address,
            items: tempCart.cart.items,
            total: tempCart.cart.total,
        });

        const emailContact = tempCart.contact && tempCart.contact.includes('@') ? tempCart.contact : null;
        if (emailContact) {
            const itemsHtml = newOrder.items.map(item => `<li>${item.quantity || 1}x ${String(item.name).replace(/[<>]/g, '')}</li>`).join('');
            const safeAddress = String(newOrder.address).replace(/[<>]/g, '');
            const mailOptions = {
                from: EMAIL_USER,
                to: emailContact,
                subject: `Your Kajal Ki Rasoi Order Confirmation #${newOrder.id.slice(-5)}`,
                html: `<h1>Thank you for your order, ${newOrder.customerName}!</h1>
                       <p>Your order is now being prepared.</p>
                       <p><strong>Delivery Address:</strong> ${safeAddress}</p>
                       <h3>Order Summary:</h3>
                       <ul>${itemsHtml}</ul>
                       <h3>Total: ₹${newOrder.total}</h3>`
            };
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) console.error('Error sending email:', error);
            });
        }

        io.emit('orderUpdate', { type: 'NEW_ORDER' });
    }

    // Check if it was a Subscription Checkout
    const tempSub = await TempSubscription.findOneAndDelete({ stripeSessionId: orderId });
    if (tempSub) {
        const newSub = await Subscription.create({
            userId: tempSub.userId,
            customerName: tempSub.customerName,
            contact: tempSub.contact,
            address: tempSub.address,
            plan: tempSub.plan,
            frequency: tempSub.frequency,
            persons: tempSub.persons,
            couponCode: tempSub.couponCode,
            price: tempSub.price,
            startDate: tempSub.startDate,
            status: 'Active' // Auto-approved because they paid!
        });

        const emailContact = tempSub.contact && tempSub.contact.includes('@') ? tempSub.contact : null;
        if (emailContact) {
            const mailOptions = {
                from: EMAIL_USER,
                to: emailContact,
                subject: `Subscription Confirmed: ${newSub.plan}`,
                html: `<h1>Welcome to Kajal Ki Rasoi, ${newSub.customerName}!</h1>
                       <p>Your subscription for <strong>${newSub.plan}</strong> has been successfully paid and activated.</p>
                       <p><strong>Deliveries start:</strong> ${new Date(newSub.startDate).toLocaleDateString('en-IN')}</p>
                       <p><strong>Amount Paid:</strong> ₹${newSub.price}</p>`
            };
            transporter.sendMail(mailOptions, (err) => { if(err) console.error(err); });
        }

        io.emit('orderUpdate', { type: 'NEW_SUBSCRIPTION', subscription: newSub });
    }
}

app.post('/api/verify-session', authenticateUser, async (req, res) => {
    const { sessionId } = req.body;
    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status === 'paid') {
            await processSuccessfulPayment(sessionId);
            res.json({ success: true });
        } else {
            res.json({ success: false, message: 'Payment not completed.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to verify session' });
    }
});

app.get('/api/profile', authenticateUser, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
        res.json({ success: true, user: { name: user.name, contact: user.contact } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error fetching profile.' });
    }
});

app.put('/api/profile', authenticateUser, async (req, res) => {
    const { name, contact, password } = req.body;
    if ((name && typeof name !== 'string') || (contact && typeof contact !== 'string') || (password && typeof password !== 'string')) {
        return res.status(400).json({ success: false, message: 'Invalid input format.' });
    }

    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        if (contact && contact !== user.contact) {
            const newContact = contact.toLowerCase();
            const userExists = await User.findOne({ contact: newContact });
            if (userExists) {
                return res.status(400).json({ success: false, message: 'Email or phone number already in use.' });
            }
            user.contact = newContact;
        }

        if (name) user.name = name;
        if (password) {
            user.password = await bcrypt.hash(password, 10);
        }

        await user.save();
        res.json({ success: true, message: 'Profile updated successfully.', user: { name: user.name, contact: user.contact, role: user.role } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update profile.' });
    }
});

app.post('/api/register', authLimiter, async (req, res) => {
    const { name, contact, password } = req.body;
    
    if (!name || !contact || !password || typeof name !== 'string' || typeof contact !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ success: false, message: 'All fields are required and must be valid text.' });
    }
    
    try {
        const userExists = await User.findOne({ contact: contact.toLowerCase() });
        if (userExists) {
            return res.status(400).json({ success: false, message: 'Account already exists with this email or phone number.' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        await User.create({ name, contact: contact.toLowerCase(), password: hashedPassword, role: 'user' });
        res.status(201).json({ success: true, message: 'Account created successfully!' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to register.' });
    }
});

app.post('/api/login', authLimiter, async (req, res) => {
    const { contact, password } = req.body;
    
    if (!contact || !password || typeof contact !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ success: false, message: 'Valid contact and password are required.' });
    }

    try {
        const user = await User.findOne({ contact: contact.toLowerCase() });
        if (user && await bcrypt.compare(password, user.password)) {
            const token = jwt.sign({ id: user._id, role: user.role }, SECRET_KEY, { expiresIn: '2h' });
            res.json({ success: true, token, user: { name: user.name, contact: user.contact, role: user.role } });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Login failed.' });
    }
});

app.post('/api/google-login', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'Token is required' });

    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const email = payload['email'].toLowerCase();
        const name = payload['name'];

        let user = await User.findOne({ contact: email });
        
        if (!user) {
            // Create a new user with a random strong password since they logged in via Google
            const randomPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10);
            const hashedPassword = await bcrypt.hash(randomPassword, 10);
            
            user = await User.create({ 
                name: name, 
                contact: email, 
                password: hashedPassword, 
                role: 'user' 
            });
        }

        const jwtToken = jwt.sign({ id: user._id, role: user.role }, SECRET_KEY, { expiresIn: '2h' });
        res.json({ success: true, token: jwtToken, user: { name: user.name, contact: user.contact, role: user.role } });
    } catch (error) {
        console.error('Google verification error:', error);
        res.status(401).json({ success: false, message: 'Invalid Google token' });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Restaurant backend running on http://localhost:${PORT}`));