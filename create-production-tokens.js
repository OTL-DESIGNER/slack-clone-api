const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// User Schema
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    default: function() {
      return this.email.split('@')[0];
    }
  },
  email: {
    type: String,
    required: [true, 'Please enter your email'],
    unique: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email']
  },
  googleId: String,
  isOnline: Boolean,
  role: String,
  phone: String,
  profilePicture: String,
  loginVerificationCode: String,
  loginVerificationCodeExpires: Date
}, {
  timestamps: true,
  versionKey: false
});

// Add JWT method using production JWT_SECRET
userSchema.methods.getSignedJwtToken = function() {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d'
  });
};

const User = mongoose.model('User', userSchema);

// User emails to generate tokens for
const userEmails = [
  'designer@ontoplocal.com',
  'jonas@ontoplocal.com'
];

async function generateProductionTokens() {
  try {
    // Connect to production MongoDB
    console.log('🔌 Connecting to production MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to production MongoDB');
    console.log(`🔑 Using JWT_SECRET: ${process.env.JWT_SECRET ? 'SET' : 'NOT SET'}`);

    console.log('\n🎫 Generating production JWT tokens...\n');

    for (const email of userEmails) {
      try {
        // Find the user in production database
        const user = await User.findOne({ email: email });

        if (!user) {
          console.log(`❌ User ${email} not found in production database`);
          continue;
        }

        // Generate new JWT token with production secret
        const token = user.getSignedJwtToken();

        console.log(`✅ User: ${user.email}`);
        console.log(`📋 Username: ${user.username}`);
        console.log(`🆔 User ID: ${user._id}`);
        console.log(`🎫 Production JWT Token: ${token}`);
        console.log(`🌐 Login URL: https://slack-clone-client-tan.vercel.app?token=${token}&email=${user.email}&username=${user.username}`);
        console.log('---');

      } catch (error) {
        console.log(`❌ Error processing user ${email}:`, error.message);
      }
    }

    console.log('\n🎉 Production token generation complete!');
    console.log('\n📝 Copy the login URLs above to access your Slack clone');

  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    console.log('\n🔍 Troubleshooting:');
    console.log('1. Make sure MONGODB_URI is set in your .env file');
    console.log('2. Make sure JWT_SECRET matches your production environment');
    console.log('3. Check if the users exist in your production database');
  } finally {
    // Close connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
}

// Check if required environment variables are set
if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is required');
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET environment variable is required');
  process.exit(1);
}

// Run the script
generateProductionTokens();
