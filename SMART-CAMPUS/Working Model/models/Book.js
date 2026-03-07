const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
    title: { type: String, required: true },
    author: { type: String, required: true },
    totalCopies: { type: Number, default: 1 },
    availableCopies: { type: Number, default: 1 },
    category: { type: String, default: "General" },
    borrowedBy: [{
        studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        borrowDate: { type: Date, default: Date.now },
        dueDate: { type: Date, default: () => new Date(+new Date() + 14*24*60*60*1000) } 
    }]
});

module.exports = mongoose.model('Book', bookSchema);