const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const ObjectId = require('mongoose').Types.ObjectId;

const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI("YOUR_API_KEY");

const model = genAI.getGenerativeModel({ 
    model: "gemini-flash-latest",
    systemInstruction: "You are the SmartCampus Assistant. You help students with library books, schedules, and campus life. Keep answers short and professional."
});

const User = require('./models/User');
const Book = require('./models/Book'); 

const app = express();

// Middleware
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

// MongoDB
mongoose.connect('mongodb://localhost:27017/smart')
.then(() => console.log("Connected to MongoDB: SmartCampus"))
.catch(err => console.error("Could not connect to MongoDB", err));


// ---------------- AUTH ROUTES ----------------

app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => {
    res.render('login');
});

// SIGNUP PAGE
app.get('/signup', (req, res) => {
    res.render('signup');
});

// SIGNUP LOGIC
app.post('/signup', async (req, res) => {
    try {
        const { email, password, role } = req.body;

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.send("User already exists");
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            email,
            password: hashedPassword,
            role
        });

        await newUser.save();

        res.redirect('/login');

    } catch (err) {
        console.error("Signup Error:", err);
        res.status(500).send("Signup error");
    }
});

// LOGIN
app.post('/login', async (req, res) => {

    const { email, password } = req.body;

    try {

        const user = await User.findOne({ email });

        if (user && await bcrypt.compare(password, user.password)) {
            req.session.user = user;
            return res.redirect('/dashboard');
        }

        res.status(400).send('Invalid Credentials');

    } catch (err) {
        res.status(500).send('Login Error');
    }

});


// ---------------- DASHBOARD ----------------

app.get('/dashboard', (req, res) => {

    if (!req.session.user) return res.redirect('/login');

    res.render('dashboard-student', { user: req.session.user });

});


// ---------------- CHATBOT ----------------

app.post('/api/chat', async (req, res) => {

    try {

        const userMessage = req.body.message;

        const result = await model.generateContent(userMessage);
        const response = await result.response;

        const text = response.text();

        res.json({ reply: text });

    } catch (error) {

        console.error("Chatbot Error:", error);

        res.status(500).json({
            reply: "I'm having trouble thinking right now."
        });

    }

});


// ---------------- LIBRARY ----------------

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

        const myBooks = await Book.find({
            "borrowedBy.studentId": new ObjectId(req.session.user._id)
        });

        res.render('library', {
            user: req.session.user,
            books,
            myBooks,
            searchQuery
        });

    } catch (err) {

        res.status(500).send("Library could not be loaded.");

    }

});


// ISSUE BOOK
app.post('/library/issue/:id', async (req, res) => {

    if (!req.session.user) return res.redirect('/login');

    try {

        const book = await Book.findById(req.params.id);

        const alreadyBorrowed = book.borrowedBy.some(
            b => b.studentId.toString() === req.session.user._id.toString()
        );

        if (book && book.availableCopies > 0 && !alreadyBorrowed) {

            book.availableCopies -= 1;

            book.borrowedBy.push({
                studentId: req.session.user._id
            });

            await book.save();
        }

        res.redirect('/library');

    } catch (err) {

        res.redirect('/library');

    }

});


// RETURN BOOK
app.post('/library/return/:id', async (req, res) => {

    if (!req.session.user) return res.redirect('/login');

    try {

        const book = await Book.findById(req.params.id);

        if (book) {

            book.borrowedBy = book.borrowedBy.filter(
                b => b.studentId.toString() !== req.session.user._id.toString()
            );

            book.availableCopies += 1;

            await book.save();
        }

        res.redirect('/library');

    } catch (err) {

        res.redirect('/library');

    }

});


// ---------------- PROFILE ----------------

app.get('/profile', async (req, res) => {

    if (!req.session.user) return res.redirect('/login');

    const user = await User.findById(req.session.user._id);

    res.render('users-profile', { user });

});

app.post('/profile/update', async (req, res) => {

    if (!req.session.user) return res.redirect('/login');

    try {

        const { fullName, department, phone, about } = req.body;

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

        res.status(500).send("Error updating profile");

    }

});


// ---------------- OTHER PAGES ----------------

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

app.get("/contact", (req, res) => {

    if (!req.session.user) return res.redirect('/login');

    res.render("contact", { user: req.session.user });

});


// LOGOUT
app.get('/logout', (req, res) => {

    req.session.destroy(() => {

        res.redirect('/login');

    });

});


// SERVER
app.listen(3000, () => {

    console.log(`Server running on http://localhost:3000`);

});