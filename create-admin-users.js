const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// User Schema (copied from your TypeScript model)
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

// Add JWT method
userSchema.methods.getSignedJwtToken = function() {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d'
  });
};

const User = mongoose.model('User', userSchema);

// Users to create
const usersToCreate = [
  {
    username: 'Designer',
    email: 'designer@ontoplocal.com'
  },
  {
    username: 'Jonas',
    email: 'jonas@ontoplocal.com'
  }
];

async function createAdminUsers() {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('\n👤 Creating admin users...\n');

    for (const userData of usersToCreate) {
      try {
        // Check if user already exists
        const existingUser = await User.findOne({ email: userData.email });

        if (existingUser) {
          console.log(`⚠️  User ${userData.email} already exists`);
          console.log(`📋 Username: ${existingUser.username}`);
          console.log(`🔑 JWT Token: ${existingUser.getSignedJwtToken()}`);
          console.log('---');
          continue;
        }

        // Create new user
        const newUser = await User.create(userData);
        console.log(`✅ Created user: ${newUser.email}`);
        console.log(`📋 Username: ${newUser.username}`);
        console.log(`🔑 JWT Token: ${newUser.getSignedJwtToken()}`);
        console.log('---');

      } catch (error) {
        console.log(`❌ Error creating user ${userData.email}:`, error.message);
      }
    }

    console.log('\n🎉 Admin user creation complete!');
    console.log('\nYou can now use these JWT tokens to log in to your frontend.');
    console.log('Add them as query parameters: ?token=YOUR_TOKEN_HERE');

  } catch (error) {
    console.error('❌ Database connection error:', error.message);
  } finally {
    // Close connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
}

// Run the script
createAdminUsers();
