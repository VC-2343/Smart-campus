const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const ObjectId = require('mongoose').Types.ObjectId;

const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI("AIzaSyCmrunEmrCpnqoD8kcsXiCl9Y9QCAM02PQ");
const model = genAI.getGenerativeModel({ 
    model: "gemini-flash-latest",
    systemInstruction: "You are the SmartCampus Assistant. You help students with library books, schedules, and campus life. Keep answers short and professional."
});

const User = require('./models/User');
const Book = require('./models/Book'); 

const app = express();

// --- Middleware ---
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');

app.use(session({ 
    secret: 'smart-campus-ultra-secret', 
    resave: false, 
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } 
}));

// --- MongoDB Connection ---
mongoose.connect('mongodb://localhost:27017/smart')
.then(() => console.log("Connected to MongoDB: SmartCampus"))
.catch(err => console.error("Could not connect to MongoDB", err));

// --- Auth Routes ---
app.get('/', (req, res) => res.redirect('/login'));
app.get('/login', (req, res) => res.render('login'));

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.user = user;
            return res.redirect('/dashboard');
        }
        res.status(400).send('Invalid Credentials');
    } catch (err) { res.status(500).send('Login Error'); }
});

app.get('/dashboard', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.render('dashboard-student', { user: req.session.user });
});

// --- CHATBOT API ROUTE ---
app.post('/api/chat', async (req, res) => {
    try {
        const userMessage = req.body.message;
        
        // This sends the user message to Gemini
        const result = await model.generateContent(userMessage);
        const response = await result.response;
        const text = response.text();

        res.json({ reply: text });
    } catch (error) {
        console.error("Chatbot Error:", error);
        res.status(500).json({ reply: "I'm having trouble thinking right now. Please try again." });
    }
});

// --- LIBRARY MANAGEMENT SYSTEM ---

app.get('/library', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    try {
        const searchQuery = req.query.search || "";
        let filter = {};
        if (searchQuery) {
            filter = {
                $or: [
                    { title: { $regex: searchQuery, $options: 'i' } },
                    { author: { $regex: searchQuery, $options: 'i' } }
                ]
            };
        }
        const books = await Book.find(filter);
        const myBooks = await Book.find({ "borrowedBy.studentId": new ObjectId(req.session.user._id) });

        res.render('library', { 
            user: req.session.user, 
            books: books, 
            myBooks: myBooks, 
            searchQuery: searchQuery 
        });
    } catch (err) {
        res.status(500).send("Library could not be loaded.");
    }
});

app.post('/library/issue/:id', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    try {
        const book = await Book.findById(req.params.id);
        const alreadyBorrowed = book.borrowedBy.some(b => b.studentId.toString() === req.session.user._id.toString());

        if (book && book.availableCopies > 0 && !alreadyBorrowed) {
            book.availableCopies -= 1;
            book.borrowedBy.push({ studentId: req.session.user._id });
            await book.save();
        }
        res.redirect('/library');
    } catch (err) { res.redirect('/library'); }
});

app.post('/library/return/:id', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    try {
        const book = await Book.findById(req.params.id);
        if (book) {
            book.borrowedBy = book.borrowedBy.filter(b => b.studentId.toString() !== req.session.user._id.toString());
            book.availableCopies += 1;
            await book.save();
        }
        res.redirect('/library');
    } catch (err) { res.redirect('/library'); }
});

app.get('/seed-library', async (req, res) => {
    try {
        const sampleBooks = [
            { title: "Clean Code", author: "Robert Martin", totalCopies: 5, availableCopies: 5, category: "Software" },
            { title: "Eloquent JavaScript", author: "Marijn Haverbeke", availableCopies: 10, category: "Web" },
            { title: "Design Patterns", author: "Gang of Four", totalCopies: 5, availableCopies: 3, category: "Software" },
            { title: "The Pragmatic Programmer", author: "Andrew Hunt", totalCopies: 5, availableCopies: 4, category: "Career" },
            { title: "Node.js Design Patterns", author: "Mario Casciaro", totalCopies: 5, availableCopies: 2, category: "Backend" },
            { title: "Intro to Algorithms", author: "Cormen", totalCopies: 5, availableCopies: 6, category: "CS" },
            { title: "You Don't Know JS", author: "Kyle Simpson", totalCopies: 5, availableCopies: 8, category: "Web" },
            { title: "Cracking the Coding Interview", author: "Gayle McDowell", totalCopies: 5, availableCopies: 12, category: "Career" },
            { title: "Refactoring", author: "Martin Fowler", availableCopies: 4, category: "Software" },
            { title: "Head First Patterns", author: "Eric Freeman", totalCopies: 5, availableCopies: 5, category: "Software" },
            { title: "The Clean Coder", author: "Robert Martin", totalCopies: 5, availableCopies: 7, category: "Career" },
            { title: "Python Crash Course", author: "Eric Matthes", totalCopies: 5, availableCopies: 9, category: "Python" },
            { title: "Modern OS", author: "Andrew Tanenbaum", totalCopies: 5, availableCopies: 3, category: "CS" },
            { title: "The Phoenix Project", author: "Gene Kim", totalCopies: 5, availableCopies: 5, category: "DevOps" },
            { title: "Domain-Driven Design", author: "Eric Evans", totalCopies: 5, availableCopies: 2, category: "Software" }
        ];

        await Book.deleteMany({}); 
        await Book.insertMany(sampleBooks);
        res.send("<h1>Books Seeded!</h1><a href='/library'>Back to Library</a>");
    } catch (e) { res.send("Error seeding database."); }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

// --- DASHBOARD NAVIGATION ROUTES ---

app.get("/attendance", (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.render("attendance", { user: req.session.user });
});

app.get("/sschedule", (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.render("studentscheduling", { user: req.session.user });
});

app.get("/sevents", (req, res) => {
    if (!req.session.user) return res.redirect('/login'); 
    res.render("studentevent", { user: req.session.user });
});

app.get("/profile", (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.render("users-profile", { user: req.session.user });
});

app.get("/contact", (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.render("contact", { user: req.session.user });
});

app.listen(3000, () => {
    console.log(`Server running on http://localhost:3000`);
});
// Show Profile
app.get("/profile", async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    
    // Fetch fresh data from DB to see if profile is complete
    const user = await User.findById(req.session.user._id);
    res.render("users-profile", { user: user });
});

// Update Profile
app.post("/profile/update", async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    
    const { fullName, department, phone, about } = req.body;
    
    await User.findByIdAndUpdate(req.session.user._id, {
        fullName,
        department,
        phone,
        about,
        isProfileComplete: true
    });

    res.redirect("/profile");
});

// Add this below your app.get('/profile') route
app.post('/profile/update', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    try {
        const { fullName, department, phone, about } = req.body;

        // 1. Update the user in the database
        const updatedUser = await User.findByIdAndUpdate(
            req.session.user._id, 
            {
                fullName,
                department,
                phone,
                about,
                isProfileComplete: true 
            },
            { new: true } 
        );
        req.session.user = updatedUser;
        res.redirect('/profile');

    } catch (err) {
        console.error("Profile Update Error:", err);
        res.status(500).send("Error updating profile");
    }
});