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
require('dotenv').config();

const app = express();

// Stripe webhook endpoint needs raw body
app.post('/webhook', express.raw({type: 'application/json'}), handleStripeWebhook);

// Restrict CORS for Production
const corsOptions = {
    origin: process.env.FRONTEND_URL || "*", // Define FRONTEND_URL in .env in production!
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions)); // Must be after webhook endpoint
app.use(express.json());

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: corsOptions
});

const SECRET_KEY = process.env.JWT_SECRET;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

if (!SECRET_KEY || !STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET || !EMAIL_USER || !EMAIL_PASS || !STRIPE_PUBLISHABLE_KEY) {
    console.error("FATAL ERROR: A required secret (JWT, Stripe, Webhook, or Publishable Key) is not defined in .env file.");
    process.exit(1);
}

const stripe = require('stripe')(STRIPE_SECRET_KEY);
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
    userId: { type: String, required: true },
    customerName: { type: String, required: true },
    items: { type: Array, required: true },
    total: { type: Number, required: true },
    status: { type: String, default: 'Preparing' },
    timestamp: { type: String, default: () => new Date().toLocaleString() },
    rating: { type: Number },
    review: { type: String }
}, { toJSON: { virtuals: true } });
const Order = mongoose.model('Order', orderSchema);

const cartSchema = new mongoose.Schema({
    paymentIntentId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    customerName: { type: String, required: true },
    cart: { type: Object, required: true }
});
const TempCart = mongoose.model('TempCart', cartSchema);

const menuItemSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    price: { type: Number, required: true },
    description: { type: String },
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
    if (count === 0) {
        await MenuItem.insertMany([
            { name: 'Special Thali', price: 180, description: '4 Roti, Rice, Seasonal Sabzi, Dal Tadka, and fresh Salad.' },
            { name: 'Rajma Chawal', price: 140, description: 'Comforting, slow-cooked Rajma served with steaming hot Jeera Rice.' },
            { name: 'Matar Paneer', price: 200, description: 'Classic North Indian dish made with peas and soft paneer in a rich, healthy tomato sauce.' },
            { name: 'Chole Bhature', price: 150, description: 'Spicy homemade chickpea curry served with fluffy, perfectly fried bhature.' },
            { name: 'Aloo Paratha', price: 120, description: 'Two stuffed whole-wheat Aloo Parathas served with fresh homemade curd and pickle.' }
        ]);
        console.log('Default Indian homestyle menu items seeded to database.');
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

app.get('/api/config/stripe', (req, res) => {
    res.json({ publishableKey: STRIPE_PUBLISHABLE_KEY });
});

app.get('/api/menu', async (req, res) => {
    const menu = await MenuItem.find({ available: true });
    res.json(menu);
});

app.get('/api/admin/menu', authenticateAdmin, async (req, res) => {
    try {
        const menu = await MenuItem.find();
        res.json(menu);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch menu items.' });
    }
});

app.post('/api/menu', authenticateAdmin, async (req, res) => {
    try {
        const { name, price, description, available } = req.body;
        if (!name || typeof price !== 'number') {
            return res.status(400).json({ success: false, message: 'A valid name and price are required.' });
        }
        const newItem = await MenuItem.create({ name, price, description, available });
        res.status(201).json({ success: true, item: newItem });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to create menu item. Ensure the name is unique.' });
    }
});

app.put('/api/menu/:id', authenticateAdmin, async (req, res) => {
    try {
        const updatedItem = await MenuItem.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ success: true, item: updatedItem });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update menu item.' });
    }
});

app.delete('/api/menu/:id', authenticateAdmin, async (req, res) => {
    try {
        await MenuItem.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Menu item deleted.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete menu item.' });
    }
});

app.post('/api/create-payment-intent', authenticateUser, async (req, res) => {
    const { items } = req.body;
    if (!Array.isArray(items)) {
        return res.status(400).json({ error: 'Invalid cart data' });
    }

    // Fetch current prices from the database securely
    const itemNames = items.map(i => String(i.name));
    const dbItems = await MenuItem.find({ name: { $in: itemNames } });
    const priceMap = {};
    dbItems.forEach(item => { priceMap[item.name] = item.price; });

    // Securely calculate total on the backend to prevent client-side manipulation
    const total = items.reduce((sum, item) => {
        const price = priceMap[String(item.name)] || 0;
        return sum + price;
    }, 0);

    if (total === 0) {
        return res.status(400).json({ error: 'Cannot process an empty cart.' });
    }

    // Create a PaymentIntent with the order amount and currency
    const paymentIntent = await stripe.paymentIntents.create({
        amount: total * 100,
        currency: 'inr',
        automatic_payment_methods: { enabled: true },
    });

    // Securely fallback to the user's registered name in the DB if the frontend payload is missing or empty
    const user = await User.findById(req.user.id);
    const safeName = (req.body.customerName && req.body.customerName.trim()) ? req.body.customerName.trim() : (user ? user.name : 'Customer');

    // Temporarily store cart data with the paymentIntentId
    await TempCart.create({
        paymentIntentId: paymentIntent.id,
        userId: req.user.id,
        customerName: safeName,
        cart: { items, total }
    });

    res.send({ clientSecret: paymentIntent.client_secret });
});

app.get('/api/orders', authenticateAdmin, async (req, res) => {
    // Fetch latest 50 orders sorted by newest first
    const limit = parseInt(req.query.limit) || 50;
    const orders = await Order.find().sort({ _id: -1 }).limit(limit);
    res.json(orders);
});

app.get('/api/users', authenticateAdmin, async (req, res) => {
    try {
        const users = await User.find({}, '-password'); // Excludes the password field from the results
        res.json(users);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch users.' });
    }
});

app.get('/api/my-orders', authenticateUser, async (req, res) => {
    // Fetch latest 20 user orders sorted by newest first
    const limit = parseInt(req.query.limit) || 20;
    const userOrders = await Order.find({ userId: req.user.id }).sort({ _id: -1 }).limit(limit);
    res.json(userOrders);
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

app.post('/api/orders/:id/complete', authenticateAdmin, async (req, res) => {
    try {
        await Order.findByIdAndUpdate(req.params.id, { status: 'Completed' });
        io.emit('orderUpdate', { type: 'ORDER_COMPLETED' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update order.' });
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
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.log(`Webhook signature verification failed.`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        console.log('PaymentIntent was successful!', paymentIntent.id);
        await processSuccessfulPayment(paymentIntent.id);
    }

    res.send();
}

async function processSuccessfulPayment(paymentIntentId) {
    // Atomically find AND delete to prevent duplicate orders if client & webhook hit at the exact same millisecond
    const tempCart = await TempCart.findOneAndDelete({ paymentIntentId });
    if (tempCart) {
        const newOrder = await Order.create({
            userId: tempCart.userId,
            customerName: tempCart.customerName,
            items: tempCart.cart.items,
            total: tempCart.cart.total,
        });

        const user = await User.findById(tempCart.userId);
        if (user && user.contact.includes('@')) {
            const itemsHtml = newOrder.items.map(item => `<li>${String(item.name).replace(/[<>]/g, '')} - ₹${Number(item.price) || 0}</li>`).join('');
            const mailOptions = {
                from: EMAIL_USER,
                to: user.contact,
                subject: `Your Kajal Kitchen Order Confirmation #${newOrder.id.slice(-5)}`,
                html: `<h1>Thank you for your order, ${newOrder.customerName}!</h1>
                       <p>Your order is now being prepared.</p>
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
}

app.post('/api/confirm-order', authenticateUser, async (req, res) => {
    const { paymentIntentId } = req.body;
    await processSuccessfulPayment(paymentIntentId);
    res.json({ success: true });
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

app.post('/api/register', async (req, res) => {
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

app.post('/api/login', async (req, res) => {
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