const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Simple script to generate production JWT tokens
console.log('🔐 Production JWT Token Generator');
console.log('================================\n');

// Check environment variables
if (!process.env.MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI not found in .env file');
  console.log('Please add your production MongoDB URI to your .env file');
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error('❌ Error: JWT_SECRET not found in .env file');
  console.log('Please add your production JWT_SECRET to your .env file');
  process.exit(1);
}

// User Schema (simplified version)
const userSchema = new mongoose.Schema({
  username: String,
  email: {
    type: String,
    required: true,
    unique: true
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

// Add JWT token generation method
userSchema.methods.getSignedJwtToken = function() {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d'
  });
};

const User = mongoose.model('User', userSchema);

async function generateTokens() {
  try {
    // Connect to production database
    console.log('🔌 Connecting to production database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected successfully!\n');

    // Find all users (or specific ones)
    const users = await User.find({
      email: { $in: ['designer@ontoplocal.com', 'jonas@ontoplocal.com'] }
    });

    if (users.length === 0) {
      console.log('⚠️  No users found with those email addresses');
      console.log('Let me check what users exist in the database...\n');

      const allUsers = await User.find({}).limit(10);
      if (allUsers.length > 0) {
        console.log('📋 Found these users in the database:');
        allUsers.forEach((user, index) => {
          console.log(`${index + 1}. ${user.email} (${user.username})`);
        });
        console.log('\nYou can generate tokens for any of these users.\n');
      } else {
        console.log('📋 No users found in the database at all.');
        console.log('You may need to create users first.\n');
      }
      return;
    }

    console.log('🎫 Generating JWT tokens...\n');

    const clientUrl = process.env.CLIENT_URL || 'https://slack-clone-client-tan.vercel.app';

    users.forEach((user, index) => {
      const token = user.getSignedJwtToken();
      const loginUrl = `${clientUrl}?token=${token}&email=${encodeURIComponent(user.email)}&username=${encodeURIComponent(user.username)}`;

      console.log(`👤 User ${index + 1}:`);
      console.log(`   📧 Email: ${user.email}`);
      console.log(`   👤 Username: ${user.username}`);
      console.log(`   🆔 User ID: ${user._id}`);
      console.log(`   🎫 JWT Token: ${token}`);
      console.log(`   🌐 Login URL: ${loginUrl}`);
      console.log('   ---');
    });

    console.log('\n🎉 Tokens generated successfully!');
    console.log('\n📋 Instructions:');
    console.log('1. Copy one of the Login URLs above');
    console.log('2. Paste it into your browser');
    console.log('3. You should be automatically logged into your Slack clone!');
    console.log('\nNote: These tokens are valid for 30 days.');

  } catch (error) {
    console.error('❌ Error:', error.message);

    if (error.message.includes('ENOTFOUND') || error.message.includes('ETIMEDOUT')) {
      console.log('\n🔍 Connection troubleshooting:');
      console.log('- Check if your MONGODB_URI is correct');
      console.log('- Make sure your MongoDB Atlas cluster allows connections from your IP');
      console.log('- Verify your database credentials are correct');
    }
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('\n🔌 Database connection closed');
    }
    process.exit(0);
  }
}

// Run the script
generateTokens();
