// models/User.js

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin','superuser'], default: 'user' },
  emailVerified: { type: Boolean, default: false },
  avatar: { type: String },
  location: { type: String },
   provider: { type: String, enum: ['local', 'google'], default: 'local' },
  googleId: { type: String, default: null },
  isActive:{type:Boolean,default:true},
  resetOtp: { type: String },
  resetOtpExpires: { type: Date },

}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance method to compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

export default  mongoose.model('User', userSchema);


