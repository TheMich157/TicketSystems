require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const mongoose = require('mongoose');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');

const bot = require('./discordBot.js');
bot.startBot();
const startHeartbeat = require('./heartbeat.js');
startHeartbeat();

const app = express();

// Apply rate limiting to all routes
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});

app.use(limiter);

// Connect to MongoDB with retry logic
const connectDB = async () => {
  try {
    await mongoose.connect('mongodb+srv://admin:admin@cluster0.1r1yo.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0/ticket-support', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    // Retry connection after 5 seconds
    setTimeout(connectDB, 5000);
  }
};

connectDB();

// Handle MongoDB connection events
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected! Attempting to reconnect...');
  setTimeout(connectDB, 5000);
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions'
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));

// Initialize Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Apply logIp middleware after Passport
const logIp = require('./middleware/logIp');
app.use(logIp);

// Apply authentication middleware
const authMiddleware = require('./middleware/auth');
app.use(authMiddleware.router);

// View engine setup
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Make user data available to all views
app.use((req, res, next) => {
  res.locals.user = req.user;
  res.locals.isAuthenticated = req.isAuthenticated();
  res.locals.isStaff = req.user && (req.user.roles.includes('Staff') || req.user.roles.includes('Admin'));
  res.locals.isAdmin = req.user && req.user.roles.includes('Admin');
  next();
});

// Check if user has Staff role
const isStaff = (req, res, next) => {
    if (req.isAuthenticated() && (req.user.roles.includes('Staff') || req.user.roles.includes('Admin'))) {
        return next();
    }
    res.status(403).render('error', {
        message: 'Access denied. Staff privileges required.'
    });
};

// Initialize Passport config
require('./config/passport'); // Ensure this line is present

// Routes
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/ticket', require('./routes/ticket'));
app.use('/staff', require('./routes/staff'));

// Error handler middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { 
    error: err, // Pass the error object
    message: 'Something went wrong!' // Pass a default error message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', { 
    error: {}, // Pass an empty error object
    message: 'Page not found' 
  });
});

// SLA breach checker
const checkSLABreaches = async () => {
    const overdueTickets = await Ticket.find({ status: { $ne: 'closed' }, slaDeadline: { $lt: new Date() } });
    overdueTickets.forEach(async (ticket) => {
        const staff = await User.findById(ticket.assignedTo);
        if (staff) {
            await sendEmail(staff.email, emailTemplates.highPriorityTicket(ticket, staff));
        }
    });
};

// Run every hour
setInterval(checkSLABreaches, 60 * 60 * 1000);

const server = http.createServer(app);
const io = new Server(server);

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
    });
});

// Emit ticket updates
const emitTicketUpdate = (ticketId, update) => {
    io.emit(`ticket-update-${ticketId}`, update);
};

module.exports = { emitTicketUpdate };

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});