const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  role: { 
    type: String, 
    enum: ['student', 'teacher', 'admin'], 
    required: true 
  },
  fullName: { 
    type: String, 
    default: '' 
  },
  department: { 
    type: String, 
    default: '' 
  },
  phone: { 
    type: String, 
    default: '' 
  },
  about: { 
    type: String, 
    default: '' 
  },
  isProfileComplete: { 
    type: Boolean, 
    default: false 
  }
});

module.exports = mongoose.model('User', userSchema);