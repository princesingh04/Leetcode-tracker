import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    trim: true,
    lowercase: true,
    sparse: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    sparse: true
  },
  password: {
    type: String
  },
  googleId: {
    type: String,
    sparse: true
  },
  leetcodeUsername: {
    type: String,
    default: '',
    trim: true
  },
  solvedProblems: {
    type: [Number],
    default: []
  },
  solvedSlugs: {
    type: [String],
    default: []
  },
  lastSynced: {
    type: Date,
    default: null
  }
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);
