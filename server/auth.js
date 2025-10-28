const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');

// Environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key-change-in-production';
const ALLOWED_DOMAIN = 'pursuit.org';
const REQUIRED_GROUP = 'staff@pursuit.org';

// Google Admin SDK setup for checking group membership
const getAdminClient = () => {
  const auth = new google.auth.GoogleAuth({
    keyFile: './service-account-key.json', // Your existing service account
    scopes: ['https://www.googleapis.com/auth/admin.directory.group.readonly'],
    // For domain-wide delegation, impersonate a domain admin
    subject: process.env.ADMIN_IMPERSONATION_EMAIL
  });
  
  return google.admin({ version: 'directory_v1', auth });
};

// Check if user is member of required Google Group
const checkGroupMembership = async (userEmail) => {
  try {
    const admin = getAdminClient();

    const response = await admin.members.hasMember({
      groupKey: REQUIRED_GROUP,
      memberKey: userEmail
    });

    return !!response.data.isMember;
  } catch (error) {
    console.error('Error checking group membership:', error);
    return false;
  }
};

// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: GOOGLE_CLIENT_ID,
  clientSecret: GOOGLE_CLIENT_SECRET,
  callbackURL: "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails[0].value;
    const domain = email.split('@')[1];
    
    // Check if user's email domain is allowed
    if (domain !== ALLOWED_DOMAIN) {
      return done(null, false, { message: 'Access denied: Invalid domain' });
    }
    
    // Check if user is member of required Google Group
    const isMember = await checkGroupMembership(email);
    if (!isMember) {
      return done(null, false, { message: 'Access denied: Not a member of required group' });
    }
    
    // User is authorized
    const user = {
      id: profile.id,
      email: email,
      name: profile.displayName,
      picture: profile.photos[0]?.value,
      domain: domain,
      groupMember: true
    };
    
    return done(null, user);
  } catch (error) {
    console.error('Authentication error:', error);
    return done(error, null);
  }
}));

// JWT Strategy for protecting routes
passport.use(new JwtStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: JWT_SECRET
}, async (payload, done) => {
  try {
    // Verify the user still has access (optional: re-check group membership)
    const user = {
      id: payload.id,
      email: payload.email,
      name: payload.name,
      picture: payload.picture
    };
    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}));

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign({
    id: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture
  }, JWT_SECRET, { expiresIn: '24h' });
};

// Middleware to protect routes
const requireAuth = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) {
      return res.status(500).json({ error: 'Authentication error' });
    }
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = user;
    next();
  })(req, res, next);
};

// Check if user has admin privileges (can be extended later)
const requireAdmin = (req, res, next) => {
  // For now, all staff@pursuit.org members are admins
  // You can extend this to check for specific roles
  if (!req.user || !req.user.email.endsWith('@pursuit.org')) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

module.exports = {
  passport,
  generateToken,
  requireAuth,
  requireAdmin,
  checkGroupMembership
}; 