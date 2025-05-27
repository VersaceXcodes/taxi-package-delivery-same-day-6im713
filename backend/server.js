import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import morgan from 'morgan';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import axios from 'axios';
import Stripe from 'stripe';
import twilio from 'twilio';
import sgMail from '@sendgrid/mail';

// Load environment variables
dotenv.config();

// ESM workaround for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize external services
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// PostgreSQL setup
import { Pool } from 'pg';
const { PGHOST, PGDATABASE, PGUSER, PGPASSWORD } = process.env;

const pool = new Pool({
  host: PGHOST || "ep-ancient-dream-abbsot9k-pooler.eu-west-2.aws.neon.tech",
  database: PGDATABASE || "neondb",
  username: PGUSER || "neondb_owner",
  password: PGPASSWORD || "npg_jAS3aITLC5DX",
  port: 5432,
  ssl: {
    require: true,
  },
});

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// Create storage directory if it doesn't exist
await fs.mkdir(path.join(__dirname, 'storage'), { recursive: true });
await fs.mkdir(path.join(__dirname, 'storage/uploads'), { recursive: true });

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'storage/uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// JWT middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'quickcourier_secret', (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Socket.io authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }

  jwt.verify(token, process.env.JWT_SECRET || 'quickcourier_secret', (err, decoded) => {
    if (err) {
      return next(new Error('Authentication error'));
    }
    socket.user = decoded;
    next();
  });
});

/*
  Helper function to generate order numbers
  Creates sequential order numbers with prefix QC and timestamp
*/
function generateOrderNumber() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `QC${timestamp}${random}`;
}

/*
  Helper function to calculate distance between two coordinates
  Uses Haversine formula for geographic distance calculation
*/
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/*
  Google Maps Geocoding API for address validation and coordinate extraction
  Function to get coordinates from address using geocoding service
*/
async function geocodeAddress(address) {
  try {
    const addressString = `${address.street_address}, ${address.city}, ${address.state} ${address.postal_code}`;
    
    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        address: addressString,
        key: process.env.GOOGLE_MAPS_API_KEY
      }
    });

    if (response.data.status === 'OK' && response.data.results.length > 0) {
      const result = response.data.results[0];
      return {
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        formatted_address: result.formatted_address,
        place_id: result.place_id
      };
    } else {
      console.warn(`Geocoding failed: ${response.data.status}`);
      // Fallback to mock coordinates for development
      return {
        latitude: 40.7589 + (Math.random() - 0.5) * 0.01,
        longitude: -73.9851 + (Math.random() - 0.5) * 0.01,
        formatted_address: `${address.street_address}, ${address.city}, ${address.state} ${address.postal_code}`
      };
    }
  } catch (error) {
    console.error('Geocoding error:', error);
    // Fallback to mock coordinates
    return {
      latitude: 40.7589 + (Math.random() - 0.5) * 0.01,
      longitude: -73.9851 + (Math.random() - 0.5) * 0.01,
      formatted_address: `${address.street_address}, ${address.city}, ${address.state} ${address.postal_code}`
    };
  }
}

/*
  Google Places API for address autocomplete functionality
  Function to get address suggestions based on user input
*/
async function getAddressAutocomplete(query) {
  try {
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      throw new Error('Google Maps API key not configured');
    }

    const response = await axios.get('https://maps.googleapis.com/maps/api/place/autocomplete/json', {
      params: {
        input: query,
        types: 'address',
        key: process.env.GOOGLE_MAPS_API_KEY
      }
    });

    if (response.data.status === 'OK') {
      return response.data.predictions.map(prediction => ({
        place_id: prediction.place_id,
        description: prediction.description,
        structured_formatting: {
          main_text: prediction.structured_formatting.main_text,
          secondary_text: prediction.structured_formatting.secondary_text
        }
      }));
    } else {
      console.warn(`Places autocomplete failed: ${response.data.status}`);
      // Fallback to mock suggestions
      return [
        {
          place_id: 'mock_place_' + Math.random(),
          description: `${query} Street, New York, NY, USA`,
          structured_formatting: {
            main_text: `${query} Street`,
            secondary_text: 'New York, NY, USA'
          }
        },
        {
          place_id: 'mock_place_' + Math.random(),
          description: `${query} Avenue, New York, NY, USA`,
          structured_formatting: {
            main_text: `${query} Avenue`,
            secondary_text: 'New York, NY, USA'
          }
        }
      ];
    }
  } catch (error) {
    console.error('Places autocomplete error:', error);
    // Fallback to mock suggestions
    return [
      {
        place_id: 'mock_place_' + Math.random(),
        description: `${query} Street, New York, NY, USA`,
        structured_formatting: {
          main_text: `${query} Street`,
          secondary_text: 'New York, NY, USA'
        }
      }
    ];
  }
}

/*
  Dynamic pricing calculation based on distance, urgency, size, and surge factors
  Implements business logic for real-time pricing with multiple premium factors
*/
function calculatePricing(distance, packageInfo, urgencyLevel) {
  const baseRate = 15.00; // Base delivery fee
  const perKmRate = 2.50; // Rate per kilometer
  
  // Distance-based pricing
  const distancePrice = Math.max(baseRate, baseRate + (distance * perKmRate));
  
  // Size multipliers
  const sizeMultipliers = { small: 1.0, medium: 1.2, large: 1.5, extra_large: 2.0 };
  const sizeMultiplier = sizeMultipliers[packageInfo.size_category] || 1.0;
  
  // Urgency multipliers
  const urgencyMultipliers = { asap: 2.0, '1_hour': 1.5, '2_hours': 1.2, '4_hours': 1.0, scheduled: 0.9 };
  const urgencyMultiplier = urgencyMultipliers[urgencyLevel] || 1.0;
  
  const basePrice = distancePrice * sizeMultiplier;
  const urgencyPremium = basePrice * (urgencyMultiplier - 1);
  const sizePremium = basePrice * (sizeMultiplier - 1);
  const specialHandlingFee = packageInfo.is_fragile ? 5.00 : 0.00;
  const serviceFeeFactor = 0.15; // 15% service fee
  const serviceFee = (basePrice + urgencyPremium + sizePremium + specialHandlingFee) * serviceFeeFactor;
  const taxRate = 0.08; // 8% tax
  const subtotal = basePrice + urgencyPremium + sizePremium + specialHandlingFee + serviceFee;
  const taxAmount = subtotal * taxRate;
  const totalAmount = subtotal + taxAmount;
  
  return {
    base_price: Math.round(basePrice * 100) / 100,
    urgency_premium: Math.round(urgencyPremium * 100) / 100,
    size_premium: Math.round(sizePremium * 100) / 100,
    special_handling_fee: Math.round(specialHandlingFee * 100) / 100,
    service_fee: Math.round(serviceFee * 100) / 100,
    tax_amount: Math.round(taxAmount * 100) / 100,
    total_amount: Math.round(totalAmount * 100) / 100
  };
}

/*
  Stripe payment processing API for secure payment handling
  Function to process payments through payment gateway
*/
async function processPaymentWithGateway(paymentData) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('Stripe secret key not configured');
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(paymentData.amount * 100), // Convert to cents
      currency: 'usd',
      payment_method: paymentData.payment_method_id,
      confirm: true,
      return_url: `${process.env.BASE_URL || 'http://localhost:3000'}/payment-return`,
      metadata: {
        order_id: paymentData.order_id || '',
        user_id: paymentData.user_id || ''
      }
    });

    return {
      transaction_id: paymentIntent.id,
      status: paymentIntent.status === 'succeeded' ? 'completed' : 'pending',
      gateway_response: JSON.stringify({
        charge_id: paymentIntent.latest_charge,
        status: paymentIntent.status,
        amount: paymentIntent.amount
      })
    };
  } catch (error) {
    console.error('Stripe payment processing error:', error);
    return {
      transaction_id: null,
      status: 'failed',
      gateway_response: JSON.stringify({
        error: error.message,
        type: error.type || 'unknown',
        code: error.code || 'unknown'
      })
    };
  }
}

/*
  SMS service (Twilio) for sending notifications
  Function to send SMS notifications to users
*/
async function sendSMSNotification(phoneNumber, message) {
  try {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
      console.warn('Twilio not configured, using mock SMS');
      console.log(`SMS to ${phoneNumber}: ${message}`);
      return { success: true, message_id: 'mock_sms_' + Date.now() };
    }

    const result = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });

    console.log(`SMS sent successfully: ${result.sid}`);
    
    return {
      success: true,
      message_id: result.sid,
      status: result.status
    };
  } catch (error) {
    console.error('SMS sending error:', error);
    return {
      success: false,
      message_id: null,
      error: error.message
    };
  }
}

/*
  Email service (SendGrid) for sending emails
  Function to send email notifications and verification emails
*/
async function sendEmailNotification(email, subject, message, isHTML = false) {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('SendGrid not configured, using mock email');
      console.log(`Email to ${email}: ${subject} - ${message}`);
      return { success: true, message_id: 'mock_email_' + Date.now() };
    }

    const msg = {
      to: email,
      from: {
        email: process.env.FROM_EMAIL || 'noreply@quickcourier.com',
        name: process.env.FROM_NAME || 'QuickCourier'
      },
      subject: subject,
      [isHTML ? 'html' : 'text']: message
    };

    const response = await sgMail.send(msg);
    console.log(`Email sent successfully to ${email}`);
    
    return {
      success: true,
      message_id: response[0].headers['x-message-id'] || 'sendgrid_' + Date.now(),
      status: 'sent'
    };
  } catch (error) {
    console.error('Email sending error:', error);
    return {
      success: false,
      message_id: null,
      error: error.message
    };
  }
}

// AUTH ENDPOINTS

/*
  User registration endpoint for senders
  Creates new sender account with email verification and password hashing
*/
app.post('/api/auth/register/sender', async (req, res) => {
  try {
    const { email, password, first_name, last_name, phone_number, marketing_opt_in = false } = req.body;
    
    // Validate input
    if (!email || !password || !first_name || !last_name || !phone_number) {
      return res.status(400).json({ success: false, message: 'All required fields must be provided' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
    }
    
    const client = await pool.connect();
    try {
      // Check if user already exists
      const existingUser = await client.query('SELECT uid FROM users WHERE email = $1 OR phone_number = $2', [email, phone_number]);
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ success: false, message: 'User with this email or phone number already exists' });
      }
      
      // Hash password
      const password_hash = await bcrypt.hash(password, 10);
      const user_id = uuidv4();
      
      // Insert user
      await client.query(
        'INSERT INTO users (uid, email, password_hash, user_type, first_name, last_name, phone_number, is_verified, is_active, marketing_opt_in, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [user_id, email, password_hash, 'sender', first_name, last_name, phone_number, 0, 1, marketing_opt_in ? 1 : 0]
      );
      
      // Create default notification preferences
      const notificationTypes = ['order_updates', 'messages', 'marketing', 'security'];
      for (const type of notificationTypes) {
        const pref_id = uuidv4();
        await client.query(
          'INSERT INTO notification_preferences (uid, user_id, notification_type, in_app_enabled, sms_enabled, email_enabled, push_enabled, timezone, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
          [pref_id, user_id, type, 1, type !== 'marketing' ? 1 : 0, type !== 'marketing' ? 1 : 0, 1, 'America/New_York']
        );
      }
      
      // Generate JWT token
      const token = jwt.sign(
        { uid: user_id, email, user_type: 'sender' },
        process.env.JWT_SECRET || 'quickcourier_secret',
        { expiresIn: '7d' }
      );
      
      // Send verification email
      await sendEmailNotification(email, 'Welcome to QuickCourier', 'Please verify your account by clicking the link in this email.');
      
      res.status(201).json({
        success: true,
        message: 'Sender account created successfully',
        data: {
          token,
          user: {
            uid: user_id,
            email,
            user_type: 'sender',
            first_name,
            last_name,
            is_verified: false
          }
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error registering sender:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/*
  User registration endpoint for couriers
  Creates courier account with vehicle info and document upload handling
*/
app.post('/api/auth/register/courier', upload.single('drivers_license_image'), async (req, res) => {
  try {
    const {
      email, password, first_name, last_name, phone_number,
      drivers_license_number, vehicle_type, vehicle_make, vehicle_model,
      vehicle_year, vehicle_color, license_plate, insurance_policy_number,
      insurance_expiry_date
    } = req.body;
    
    if (!email || !password || !first_name || !last_name || !phone_number || !drivers_license_number || !vehicle_type || !license_plate) {
      return res.status(400).json({ success: false, message: 'All required fields must be provided' });
    }
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Driver license image is required' });
    }
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Check if user already exists
      const existingUser = await client.query('SELECT uid FROM users WHERE email = $1 OR phone_number = $2', [email, phone_number]);
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ success: false, message: 'User with this email or phone number already exists' });
      }
      
      const password_hash = await bcrypt.hash(password, 10);
      const user_id = uuidv4();
      const license_image_url = `/uploads/${req.file.filename}`;
      
      // Insert user
      await client.query(
        'INSERT INTO users (uid, email, password_hash, user_type, first_name, last_name, phone_number, is_verified, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [user_id, email, password_hash, 'courier', first_name, last_name, phone_number, 0, 1]
      );
      
      // Insert courier profile
      const courier_profile_id = uuidv4();
      await client.query(
        'INSERT INTO courier_profiles (uid, user_id, drivers_license_number, drivers_license_image_url, background_check_status, verification_status, total_deliveries, average_rating, total_earnings, is_available, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [courier_profile_id, user_id, drivers_license_number, license_image_url, 'pending', 'pending', 0, 0.0, 0.0, 0]
      );
      
      // Insert vehicle
      const vehicle_id = uuidv4();
      await client.query(
        'INSERT INTO vehicles (uid, courier_id, vehicle_type, make, model, year, color, license_plate, insurance_policy_number, insurance_expiry_date, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [vehicle_id, user_id, vehicle_type, vehicle_make, vehicle_model, vehicle_year ? parseInt(vehicle_year) : null, vehicle_color, license_plate, insurance_policy_number, insurance_expiry_date, 1]
      );
      
      // Insert courier availability
      const availability_id = uuidv4();
      await client.query(
        'INSERT INTO courier_availability (uid, courier_id, is_available, availability_status, max_concurrent_orders, current_active_orders, last_update, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [availability_id, user_id, 0, 'offline', 1, 0]
      );
      
      await client.query('COMMIT');
      
      // Generate JWT token
      const token = jwt.sign(
        { uid: user_id, email, user_type: 'courier' },
        process.env.JWT_SECRET || 'quickcourier_secret',
        { expiresIn: '7d' }
      );
      
      res.status(201).json({
        success: true,
        message: 'Courier account created successfully',
        data: {
          token,
          user: {
            uid: user_id,
            email,
            user_type: 'courier',
            first_name,
            last_name,
            is_verified: false
          }
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error registering courier:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/*
  User authentication endpoint
  Validates credentials and returns JWT token for API access
*/
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT uid, email, password_hash, user_type, first_name, last_name, is_verified, is_active FROM users WHERE email = $1 AND is_active = 1',
        [email]
      );
      
      if (result.rows.length === 0) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
      
      const user = result.rows[0];
      const validPassword = await bcrypt.compare(password, user.password_hash);
      
      if (!validPassword) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
      
      // Update last login time
      await client.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE uid = $1', [user.uid]);
      
      // Generate JWT token
      const token = jwt.sign(
        { uid: user.uid, email: user.email, user_type: user.user_type },
        process.env.JWT_SECRET || 'quickcourier_secret',
        { expiresIn: '7d' }
      );
      
      res.json({
        success: true,
        message: 'Login successful',
        data: {
          token,
          user: {
            uid: user.uid,
            email: user.email,
            user_type: user.user_type,
            first_name: user.first_name,
            last_name: user.last_name,
            is_verified: user.is_verified === 1
          }
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/*
  Password reset request endpoint
  Initiates password reset process by sending verification code
*/
app.post('/api/auth/password/reset', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT uid, first_name FROM users WHERE email = $1', [email]);
      
      if (result.rows.length > 0) {
        // Send reset email (in production, would generate secure token)
        await sendEmailNotification(email, 'Password Reset Request', 'Use code 123456 to reset your password');
      }
      
      // Always return success to prevent email enumeration
      res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent'
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error requesting password reset:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ADDRESS ENDPOINTS

/*
  Address autocomplete endpoint using geocoding service
  Provides real-time address suggestions as user types
*/
app.get('/api/addresses/autocomplete', async (req, res) => {
  try {
    const { query, limit = 10 } = req.query;
    
    if (!query || query.length < 3) {
      return res.status(400).json({ success: false, message: 'Query must be at least 3 characters' });
    }
    
    const suggestions = await getAddressAutocomplete(query);
    
    res.json({
      success: true,
      data: suggestions.slice(0, limit)
    });
  } catch (error) {
    console.error('Error getting address autocomplete:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/*
  Get user's saved addresses
  Returns list of frequently used addresses with usage statistics
*/
app.get('/api/addresses', authenticateToken, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT sa.uid, sa.label, sa.is_default_pickup, sa.is_default_delivery, sa.use_count,
               a.uid as address_id, a.street_address, a.apartment_unit, a.city, a.state, 
               a.postal_code, a.country, a.building_instructions, a.access_code, a.is_residential
        FROM saved_addresses sa
        JOIN addresses a ON sa.address_id = a.uid
        WHERE sa.user_id = $1
        ORDER BY sa.use_count DESC, sa.created_at DESC
      `, [req.user.uid]);
      
      const addresses = result.rows.map(row => ({
        uid: row.uid,
        label: row.label,
        is_default_pickup: row.is_default_pickup === 1,
        is_default_delivery: row.is_default_delivery === 1,
        use_count: row.use_count,
        address: {
          uid: row.address_id,
          street_address: row.street_address,
          apartment_unit: row.apartment_unit,
          city: row.city,
          state: row.state,
          postal_code: row.postal_code,
          country: row.country,
          building_instructions: row.building_instructions,
          access_code: row.access_code,
          is_residential: row.is_residential === 1
        }
      }));
      
      res.json({ success: true, data: addresses });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error getting saved addresses:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/*
  Save new address for user
  Creates address record and links it to user's saved addresses
*/
app.post('/api/addresses', authenticateToken, async (req, res) => {
  try {
    const {
      street_address, apartment_unit, city, state, postal_code, country = 'USA',
      building_instructions, access_code, is_residential = true,
      label, is_default_pickup = false, is_default_delivery = false
    } = req.body;
    
    if (!street_address || !city || !state || !postal_code) {
      return res.status(400).json({ success: false, message: 'Required address fields are missing' });
    }
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Geocode address to get coordinates
      const geocoding = await geocodeAddress({ street_address, city, state, postal_code });
      
      // Insert address
      const address_id = uuidv4();
      await client.query(
        'INSERT INTO addresses (uid, street_address, apartment_unit, city, state, postal_code, country, latitude, longitude, building_instructions, access_code, is_residential, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [address_id, street_address, apartment_unit, city, state, postal_code, country, geocoding.latitude, geocoding.longitude, building_instructions, access_code, is_residential ? 1 : 0]
      );
      
      // Insert saved address
      const saved_address_id = uuidv4();
      await client.query(
        'INSERT INTO saved_addresses (uid, user_id, address_id, label, is_default_pickup, is_default_delivery, use_count, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [saved_address_id, req.user.uid, address_id, label, is_default_pickup ? 1 : 0, is_default_delivery ? 1 : 0, 0]
      );
      
      await client.query('COMMIT');
      
      res.status(201).json({
        success: true,
        data: {
          uid: saved_address_id,
          label,
          is_default_pickup,
          is_default_delivery,
          use_count: 0,
          address: {
            uid: address_id,
            street_address,
            apartment_unit,
            city,
            state,
            postal_code,
            country,
            building_instructions,
            access_code,
            is_residential
          }
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error saving address:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ORDER ENDPOINTS

/*
  Get pricing estimate for delivery
  Calculates dynamic pricing based on distance, package size, and urgency
*/
app.post('/api/orders/pricing/estimate', async (req, res) => {
  try {
    const { pickup_address, delivery_address, package, urgency_level } = req.body;
    
    if (!pickup_address || !delivery_address || !package || !urgency_level) {
      return res.status(400).json({ success: false, message: 'All required fields must be provided' });
    }
    
    // Calculate distance between pickup and delivery
    const distance = calculateDistance(
      pickup_address.latitude,
      pickup_address.longitude,
      delivery_address.latitude,
      delivery_address.longitude
    );
    
    // Calculate pricing
    const pricing = calculatePricing(distance, package, urgency_level);
    
    // Calculate estimated times based on urgency
    const now = new Date();
    let estimatedPickupTime, estimatedDeliveryTime;
    
    switch (urgency_level) {
      case 'asap':
        estimatedPickupTime = new Date(now.getTime() + 15 * 60000); // 15 minutes
        estimatedDeliveryTime = new Date(now.getTime() + 45 * 60000); // 45 minutes
        break;
      case '1_hour':
        estimatedPickupTime = new Date(now.getTime() + 30 * 60000); // 30 minutes
        estimatedDeliveryTime = new Date(now.getTime() + 90 * 60000); // 1.5 hours
        break;
      case '2_hours':
        estimatedPickupTime = new Date(now.getTime() + 60 * 60000); // 1 hour
        estimatedDeliveryTime = new Date(now.getTime() + 180 * 60000); // 3 hours
        break;
      default:
        estimatedPickupTime = new Date(now.getTime() + 120 * 60000); // 2 hours
        estimatedDeliveryTime = new Date(now.getTime() + 300 * 60000); // 5 hours
    }
    
    res.json({
      success: true,
      data: {
        ...pricing,
        estimated_pickup_time: estimatedPickupTime.toISOString(),
        estimated_delivery_time: estimatedDeliveryTime.toISOString(),
        distance: Math.round(distance * 100) / 100
      }
    });
  } catch (error) {
    console.error('Error calculating pricing estimate:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/*
  Create new delivery order
  Handles complex order creation with address geocoding, pricing, and courier matching
*/
app.post('/api/orders', authenticateToken, async (req, res) => {
  try {
    if (req.user.user_type !== 'sender') {
      return res.status(403).json({ success: false, message: 'Only senders can create orders' });
    }
    
    const {
      pickup_address, delivery_address, recipient_name, recipient_phone,
      package, urgency_level, scheduled_pickup_date, scheduled_pickup_time,
      pickup_instructions, delivery_instructions, leave_at_door = false,
      payment_method_id
    } = req.body;
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Create or find pickup address
      const pickupGeocode = await geocodeAddress(pickup_address);
      const pickup_address_id = uuidv4();
      await client.query(
        'INSERT INTO addresses (uid, street_address, apartment_unit, city, state, postal_code, country, latitude, longitude, building_instructions, access_code, is_residential, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [pickup_address_id, pickup_address.street_address, pickup_address.apartment_unit, pickup_address.city, pickup_address.state, pickup_address.postal_code, pickup_address.country || 'USA', pickupGeocode.latitude, pickupGeocode.longitude, pickup_address.building_instructions, pickup_address.access_code, 1]
      );
      
      // Create or find delivery address
      const deliveryGeocode = await geocodeAddress(delivery_address);
      const delivery_address_id = uuidv4();
      await client.query(
        'INSERT INTO addresses (uid, street_address, apartment_unit, city, state, postal_code, country, latitude, longitude, building_instructions, access_code, is_residential, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [delivery_address_id, delivery_address.street_address, delivery_address.apartment_unit, delivery_address.city, delivery_address.state, delivery_address.postal_code, delivery_address.country || 'USA', deliveryGeocode.latitude, deliveryGeocode.longitude, delivery_address.building_instructions, delivery_address.access_code, 1]
      );
      
      // Calculate distance and pricing
      const distance = calculateDistance(pickupGeocode.latitude, pickupGeocode.longitude, deliveryGeocode.latitude, deliveryGeocode.longitude);
      const pricing = calculatePricing(distance, package, urgency_level);
      const order_number = generateOrderNumber();
      const order_id = uuidv4();
      
      // Calculate estimated times
      const now = new Date();
      let estimatedPickupTime, estimatedDeliveryTime;
      
      if (urgency_level === 'scheduled' && scheduled_pickup_date && scheduled_pickup_time) {
        estimatedPickupTime = new Date(`${scheduled_pickup_date}T${scheduled_pickup_time}`);
        estimatedDeliveryTime = new Date(estimatedPickupTime.getTime() + 2 * 60 * 60000); // 2 hours after pickup
      } else {
        switch (urgency_level) {
          case 'asap':
            estimatedPickupTime = new Date(now.getTime() + 15 * 60000);
            estimatedDeliveryTime = new Date(now.getTime() + 45 * 60000);
            break;
          case '1_hour':
            estimatedPickupTime = new Date(now.getTime() + 30 * 60000);
            estimatedDeliveryTime = new Date(now.getTime() + 90 * 60000);
            break;
          case '2_hours':
            estimatedPickupTime = new Date(now.getTime() + 60 * 60000);
            estimatedDeliveryTime = new Date(now.getTime() + 180 * 60000);
            break;
          default:
            estimatedPickupTime = new Date(now.getTime() + 120 * 60000);
            estimatedDeliveryTime = new Date(now.getTime() + 300 * 60000);
        }
      }
      
      // Insert delivery order
      await client.query(
        `INSERT INTO delivery_orders (uid, order_number, sender_id, pickup_address_id, delivery_address_id, recipient_name, recipient_phone, status, urgency_level, scheduled_pickup_date, scheduled_pickup_time, pickup_instructions, delivery_instructions, leave_at_door, estimated_pickup_time, estimated_delivery_time, base_price, urgency_premium, size_premium, special_handling_fee, service_fee, tax_amount, total_amount, payment_status, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [order_id, order_number, req.user.uid, pickup_address_id, delivery_address_id, recipient_name, recipient_phone, 'pending', urgency_level, scheduled_pickup_date, scheduled_pickup_time, pickup_instructions, delivery_instructions, leave_at_door ? 1 : 0, estimatedPickupTime, estimatedDeliveryTime, pricing.base_price, pricing.urgency_premium, pricing.size_premium, pricing.special_handling_fee, pricing.service_fee, pricing.tax_amount, pricing.total_amount, 'pending']
      );
      
      // Insert package details
      const package_id = uuidv4();
      await client.query(
        'INSERT INTO packages (uid, order_id, package_type, size_category, estimated_weight, declared_value, is_fragile, special_handling_notes, package_description, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [package_id, order_id, package.package_type, package.size_category, package.estimated_weight, package.declared_value, package.is_fragile ? 1 : 0, package.special_handling_notes, package.package_description]
      );
      
      // Insert initial status history
      const status_history_id = uuidv4();
      await client.query(
        'INSERT INTO order_status_history (uid, order_id, previous_status, new_status, changed_by, timestamp, additional_notes, created_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, CURRENT_TIMESTAMP)',
        [status_history_id, order_id, null, 'pending', req.user.uid, 'Order created by sender']
      );
      
      await client.query('COMMIT');
      
      // Process payment
      const paymentResult = await processPaymentWithGateway({
        amount: pricing.total_amount,
        payment_method_id,
        order_id,
        user_id: req.user.uid
      });
      
      if (paymentResult.status === 'completed') {
        await client.query('UPDATE delivery_orders SET payment_status = $1 WHERE uid = $2', ['paid', order_id]);
        
        // Create payment record
        const payment_id = uuidv4();
        await client.query(
          'INSERT INTO payments (uid, order_id, user_id, payment_method_id, transaction_id, payment_gateway, payment_type, amount, currency, status, gateway_response, processed_at, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
          [payment_id, order_id, req.user.uid, payment_method_id, paymentResult.transaction_id, 'stripe', 'card', pricing.total_amount, 'USD', 'completed', paymentResult.gateway_response]
        );
      }
      
      // Trigger courier matching (emit to socket for real-time courier assignment)
      io.emit('new_order_for_matching', {
        order_id,
        pickup_location: { latitude: pickupGeocode.latitude, longitude: pickupGeocode.longitude },
        urgency_level,
        estimated_earnings: pricing.total_amount * 0.75 // 75% to courier
      });
      
      res.status(201).json({
        success: true,
        message: 'Order created successfully',
        data: {
          order_id,
          order_number,
          pricing,
          estimated_pickup_time: estimatedPickupTime.toISOString(),
          estimated_delivery_time: estimatedDeliveryTime.toISOString(),
          status: 'pending'
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/*
  Get user's delivery orders with filtering and pagination
  Returns comprehensive order data including addresses, packages, and status
*/
app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const {
      status,
      page = 1,
      limit = 20,
      date_from,
      date_to
    } = req.query;
    
    const offset = (page - 1) * limit;
    let query = `
      SELECT do.*, 
             pa.street_address as pickup_street, pa.city as pickup_city, pa.state as pickup_state,
             da.street_address as delivery_street, da.city as delivery_city, da.state as delivery_state,
             p.package_type, p.size_category, p.is_fragile,
             cu.first_name as courier_first_name, cu.last_name as courier_last_name,
             cp.average_rating as courier_rating
      FROM delivery_orders do
      LEFT JOIN addresses pa ON do.pickup_address_id = pa.uid
      LEFT JOIN addresses da ON do.delivery_address_id = da.uid
      LEFT JOIN packages p ON do.uid = p.order_id
      LEFT JOIN users cu ON do.courier_id = cu.uid
      LEFT JOIN courier_profiles cp ON cu.uid = cp.user_id
      WHERE do.sender_id = $1
    `;
    
    const queryParams = [req.user.uid];
    let paramIndex = 2;
    
    if (status) {
      query += ` AND do.status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }
    
    if (date_from) {
      query += ` AND do.created_at >= $${paramIndex}`;
      queryParams.push(date_from);
      paramIndex++;
    }
    
    if (date_to) {
      query += ` AND do.created_at <= $${paramIndex}`;
      queryParams.push(date_to + ' 23:59:59');
      paramIndex++;
    }
    
    query += ` ORDER BY do.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);
    
    const client = await pool.connect();
    try {
      const result = await client.query(query, queryParams);
      
      // Get total count for pagination
      let countQuery = 'SELECT COUNT(*) FROM delivery_orders WHERE sender_id = $1';
      const countParams = [req.user.uid];
      
      if (status) {
        countQuery += ' AND status = $2';
        countParams.push(status);
      }
      
      const countResult = await client.query(countQuery, countParams);
      const totalCount = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(totalCount / limit);
      
      const orders = result.rows.map(row => ({
        uid: row.uid,
        order_number: row.order_number,
        status: row.status,
        urgency_level: row.urgency_level,
        recipient_name: row.recipient_name,
        recipient_phone: row.recipient_phone,
        pickup_address: `${row.pickup_street}, ${row.pickup_city}, ${row.pickup_state}`,
        delivery_address: `${row.delivery_street}, ${row.delivery_city}, ${row.delivery_state}`,
        package: {
          type: row.package_type,
          size: row.size_category,
          is_fragile: row.is_fragile === 1
        },
        courier: row.courier_first_name ? {
          name: `${row.courier_first_name} ${row.courier_last_name}`,
          rating: row.courier_rating
        } : null,
        total_amount: row.total_amount,
        payment_status: row.payment_status,
        estimated_pickup_time: row.estimated_pickup_time,
        estimated_delivery_time: row.estimated_delivery_time,
        actual_pickup_time: row.actual_pickup_time,
        actual_delivery_time: row.actual_delivery_time,
        created_at: row.created_at
      }));
      
      res.json({
        success: true,
        data: {
          orders,
          pagination: {
            current_page: parseInt(page),
            total_pages: totalPages,
            total_count: totalCount,
            has_next: page < totalPages,
            has_prev: page > 1
          }
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error getting orders:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/*
  Get specific order details with complete information
  Returns detailed order data including tracking history and messages
*/
app.get('/api/orders/:order_id', authenticateToken, async (req, res) => {
  try {
    const { order_id } = req.params;
    
    const client = await pool.connect();
    try {
      // Get order details
      const orderResult = await client.query(`
        SELECT do.*, 
               pa.street_address as pickup_street, pa.apartment_unit as pickup_apt, pa.city as pickup_city, 
               pa.state as pickup_state, pa.postal_code as pickup_zip, pa.building_instructions as pickup_instructions,
               da.street_address as delivery_street, da.apartment_unit as delivery_apt, da.city as delivery_city, 
               da.state as delivery_state, da.postal_code as delivery_zip, da.building_instructions as delivery_instructions,
               p.package_type, p.size_category, p.estimated_weight, p.declared_value, p.is_fragile, p.package_description,
               p.pickup_photo_url, p.delivery_photo_url,
               cu.first_name as courier_first_name, cu.last_name as courier_last_name, cu.phone_number as courier_phone,
               cp.average_rating as courier_rating, cp.current_location_lat, cp.current_location_lng
        FROM delivery_orders do
        LEFT JOIN addresses pa ON do.pickup_address_id = pa.uid
        LEFT JOIN addresses da ON do.delivery_address_id = da.uid
        LEFT JOIN packages p ON do.uid = p.order_id
        LEFT JOIN users cu ON do.courier_id = cu.uid
        LEFT JOIN courier_profiles cp ON cu.uid = cp.user_id
        WHERE do.uid = $1 AND (do.sender_id = $2 OR do.courier_id = $2)
      `, [order_id, req.user.uid]);
      
      if (orderResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      
      const order = orderResult.rows[0];
      
      // Get status history
      const historyResult = await client.query(`
        SELECT osh.*, u.first_name, u.last_name
        FROM order_status_history osh
        LEFT JOIN users u ON osh.changed_by = u.uid
        WHERE osh.order_id = $1
        ORDER BY osh.timestamp ASC
      `, [order_id]);
      
      res.json({
        success: true,
        data: {
          uid: order.uid,
          order_number: order.order_number,
          status: order.status,
          urgency_level: order.urgency_level,
          recipient_name: order.recipient_name,
          recipient_phone: order.recipient_phone,
          pickup_address: {
            street_address: order.pickup_street,
            apartment_unit: order.pickup_apt,
            city: order.pickup_city,
            state: order.pickup_state,
            postal_code: order.pickup_zip,
            building_instructions: order.pickup_instructions
          },
          delivery_address: {
            street_address: order.delivery_street,
            apartment_unit: order.delivery_apt,
            city: order.delivery_city,
            state: order.delivery_state,
            postal_code: order.delivery_zip,
            building_instructions: order.delivery_instructions
          },
          package: {
            package_type: order.package_type,
            size_category: order.size_category,
            estimated_weight: order.estimated_weight,
            declared_value: order.declared_value,
            is_fragile: order.is_fragile === 1,
            package_description: order.package_description,
            pickup_photo_url: order.pickup_photo_url,
            delivery_photo_url: order.delivery_photo_url
          },
          courier: order.courier_first_name ? {
            name: `${order.courier_first_name} ${order.courier_last_name}`,
            phone: order.courier_phone,
            rating: order.courier_rating,
            current_location: order.current_location_lat ? {
              latitude: order.current_location_lat,
              longitude: order.current_location_lng
            } : null
          } : null,
          pricing: {
            base_price: order.base_price,
            urgency_premium: order.urgency_premium,
            size_premium: order.size_premium,
            special_handling_fee: order.special_handling_fee,
            service_fee: order.service_fee,
            tax_amount: order.tax_amount,
            total_amount: order.total_amount
          },
          payment_status: order.payment_status,
          estimated_pickup_time: order.estimated_pickup_time,
          estimated_delivery_time: order.estimated_delivery_time,
          actual_pickup_time: order.actual_pickup_time,
          actual_delivery_time: order.actual_delivery_time,
          pickup_instructions: order.pickup_instructions,
          delivery_instructions: order.delivery_instructions,
          leave_at_door: order.leave_at_door === 1,
          status_history: historyResult.rows.map(h => ({
            status: h.new_status,
            timestamp: h.timestamp,
            changed_by: h.first_name ? `${h.first_name} ${h.last_name}` : 'System',
            notes: h.additional_notes
          })),
          created_at: order.created_at
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error getting order details:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/*
  Update order status (primarily for couriers)
  Handles status transitions and creates audit trail
*/
app.put('/api/orders/:order_id', authenticateToken, async (req, res) => {
  try {
    const { order_id } = req.params;
    const { status, pickup_instructions, delivery_instructions, actual_pickup_time, actual_delivery_time, cancellation_reason } = req.body;
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Get current order
      const currentOrder = await client.query(
        'SELECT * FROM delivery_orders WHERE uid = $1 AND (sender_id = $2 OR courier_id = $2)',
        [order_id, req.user.uid]
      );
      
      if (currentOrder.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      
      const order = currentOrder.rows[0];
      let updateFields = [];
      let updateValues = [];
      let paramIndex = 1;
      
      if (status && status !== order.status) {
        updateFields.push(`status = $${paramIndex}`);
        updateValues.push(status);
        paramIndex++;
        
        // Create status history record
        const history_id = uuidv4();
        await client.query(
          'INSERT INTO order_status_history (uid, order_id, previous_status, new_status, changed_by, timestamp, additional_notes, created_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, CURRENT_TIMESTAMP)',
          [history_id, order_id, order.status, status, req.user.uid, `Status changed to ${status}`]
        );
        
        // Emit real-time status change
        io.to(`order_${order_id}`).emit('order_status_change', {
          event: 'order_status_change',
          order_id,
          order_number: order.order_number,
          status: {
            current: status,
            previous: order.status,
            timestamp: new Date().toISOString(),
            changed_by: req.user.uid
          }
        });
      }
      
      if (pickup_instructions !== undefined) {
        updateFields.push(`pickup_instructions = $${paramIndex}`);
        updateValues.push(pickup_instructions);
        paramIndex++;
      }
      
      if (delivery_instructions !== undefined) {
        updateFields.push(`delivery_instructions = $${paramIndex}`);
        updateValues.push(delivery_instructions);
        paramIndex++;
      }
      
      if (actual_pickup_time) {
        updateFields.push(`actual_pickup_time = $${paramIndex}`);
        updateValues.push(actual_pickup_time);
        paramIndex++;
      }
      
      if (actual_delivery_time) {
        updateFields.push(`actual_delivery_time = $${paramIndex}`);
        updateValues.push(actual_delivery_time);
        paramIndex++;
      }
      
      if (cancellation_reason) {
        updateFields.push(`cancellation_reason = $${paramIndex}`, `cancelled_by = $${paramIndex + 1}`, `cancelled_at = CURRENT_TIMESTAMP`);
        updateValues.push(cancellation_reason, req.user.user_type);
        paramIndex += 2;
      }
      
      if (updateFields.length > 0) {
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        updateValues.push(order_id);
        
        await client.query(
          `UPDATE delivery_orders SET ${updateFields.join(', ')} WHERE uid = $${paramIndex}`,
          updateValues
        );
      }
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        message: 'Order updated successfully',
        data: { order_id, status: status || order.status }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/*
  Upload package photos during pickup or delivery
  Handles secure file storage and links photos to package records
*/
app.post('/api/orders/:order_id/photos', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    const { order_id } = req.params;
    const { photo_type, caption } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Photo file is required' });
    }
    
    if (!photo_type || !['pickup', 'delivery'].includes(photo_type)) {
      return res.status(400).json({ success: false, message: 'Valid photo_type (pickup/delivery) is required' });
    }
    
    const client = await pool.connect();
    try {
      // Verify user has access to this order
      const orderCheck = await client.query(
        'SELECT courier_id FROM delivery_orders WHERE uid = $1',
        [order_id]
      );
      
      if (orderCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      
      if (orderCheck.rows[0].courier_id !== req.user.uid) {
        return res.status(403).json({ success: false, message: 'Only assigned couriers can upload photos' });
      }
      
      const photo_url = `/uploads/${req.file.filename}`;
      const field = photo_type === 'pickup' ? 'pickup_photo_url' : 'delivery_photo_url';
      
      // Update package with photo URL
      await client.query(
        `UPDATE packages SET ${field} = $1 WHERE order_id = $2`,
        [photo_url, order_id]
      );
      
      res.status(201).json({
        success: true,
        data: {
          photo_url,
          photo_type,
          upload_timestamp: new Date().toISOString()
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error uploading package photo:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// COURIER ENDPOINTS

/*
  Update courier availability status
  Manages courier online/offline status and work capacity
*/
app.put('/api/couriers/availability', authenticateToken, async (req, res) => {
  try {
    if (req.user.user_type !== 'courier') {
      return res.status(403).json({ success: false, message: 'Only couriers can update availability' });
    }
    
    const {
      is_available,
      availability_status,
      break_duration_minutes,
      shift_start_time,
      shift_end_time,
      max_concurrent_orders = 1
    } = req.body;
    
    const client = await pool.connect();
    try {
      await client.query(
        'UPDATE courier_availability SET is_available = $1, availability_status = $2, break_duration_minutes = $3, shift_start_time = $4, shift_end_time = $5, max_concurrent_orders = $6, last_update = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE courier_id = $7',
        [is_available ? 1 : 0, availability_status, break_duration_minutes, shift_start_time, shift_end_time, max_concurrent_orders, req.user.uid]
      );
      
      // Update courier profile availability
      await client.query(
        'UPDATE courier_profiles SET is_available = $1 WHERE user_id = $2',
        [is_available ? 1 : 0, req.user.uid]
      );
      
      // Emit availability change to system
      io.emit('courier_availability_status', {
        event: 'courier_availability_status',
        courier_id: req.user.uid,
        availability: {
          is_available,
          status: availability_status,
          last_update: new Date().toISOString()
        }
      });
      
      res.json({
        success: true,
        message: 'Availability updated successfully',
        data: {
          is_available,
          availability_status,
          max_concurrent_orders
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating courier availability:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/*
  Update courier location for real-time tracking
  Stores location data and triggers real-time location broadcasts
*/
app.post('/api/couriers/location', authenticateToken, async (req, res) => {
  try {
    if (req.user.user_type !== 'courier') {
      return res.status(403).json({ success: false, message: 'Only couriers can update location' });
    }
    
    const { latitude, longitude, accuracy, speed, heading, battery_level, order_id } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, message: 'Latitude and longitude are required' });
    }
    
    const client = await pool.connect();
    try {
      // Insert location tracking record
      const location_id = uuidv4();
      await client.query(
        'INSERT INTO location_tracking (uid, courier_id, order_id, latitude, longitude, accuracy, speed, heading, timestamp, battery_level, is_active_delivery, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, $9, $10, CURRENT_TIMESTAMP)',
        [location_id, req.user.uid, order_id, latitude, longitude, accuracy, speed, heading, battery_level, order_id ? 1 : 0]
      );
      
      // Update courier profile location
      await client.query(
        'UPDATE courier_profiles SET current_location_lat = $1, current_location_lng = $2, last_location_update = CURRENT_TIMESTAMP WHERE user_id = $3',
        [latitude, longitude, req.user.uid]
      );
      
      // If courier is on active delivery, broadcast location update
      if (order_id) {
        io.to(`order_${order_id}`).emit('location_update', {
          event: 'location_update',
          order_id,
          courier: {
            location: {
              latitude,
              longitude,
              accuracy,
              speed,
              heading
            },
            timestamp: new Date().toISOString(),
            battery_level
          }
        });
      }
      
      res.json({
        success: true,
        data: {
          location_updated: true,
          timestamp: new Date().toISOString()
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating courier location:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/*
  Get courier's delivery assignments
  Returns active and historical assignments with response tracking
*/
app.get('/api/couriers/assignments', authenticateToken, async (req, res) => {
  try {
    if (req.user.user_type !== 'courier') {
      return res.status(403).json({ success: false, message: 'Only couriers can view assignments' });
    }
    
    const { status, active_only = false } = req.query;
    
    const client = await pool.connect();
    try {
      let query = `
        SELECT oa.*, do.order_number, do.status as order_status, do.urgency_level,
               do.total_amount, do.courier_earnings,
               pa.street_address as pickup_address, pa.city as pickup_city,
               da.street_address as delivery_address, da.city as delivery_city,
               p.package_type, p.size_category
        FROM order_assignments oa
        JOIN delivery_orders do ON oa.order_id = do.uid
        LEFT JOIN addresses pa ON do.pickup_address_id = pa.uid
        LEFT JOIN addresses da ON do.delivery_address_id = da.uid
        LEFT JOIN packages p ON do.uid = p.order_id
        WHERE oa.courier_id = $1
      `;
      
      const queryParams = [req.user.uid];
      let paramIndex = 2;
      
      if (active_only) {
        query += ` AND oa.assignment_status IN ('pending', 'accepted') AND do.status NOT IN ('delivered', 'cancelled', 'failed')`;
      }
      
      if (status) {
        query += ` AND oa.assignment_status = $${paramIndex}`;
        queryParams.push(status);
        paramIndex++;
      }
      
      query += ` ORDER BY oa.offered_at DESC`;
      
      const result = await client.query(query, queryParams);
      
      const assignments = result.rows.map(row => ({
        assignment_id: row.uid,
        order: {
          order_id: row.order_id,
          order_number: row.order_number,
          status: row.order_status,
          pickup_address: `${row.pickup_address}, ${row.pickup_city}`,
          delivery_address: `${row.delivery_address}, ${row.delivery_city}`,
          package_type: row.package_type,
          size_category: row.size_category,
          urgency_level: row.urgency_level,
          estimated_earnings: row.courier_earnings || (row.total_amount * 0.75)
        },
        assignment_status: row.assignment_status,
        offered_at: row.offered_at,
        response_deadline: row.response_deadline,
        accepted_at: row.accepted_at,
        declined_at: row.declined_at,
        decline_reason: row.decline_reason,
        distance_to_pickup: row.courier_distance_km
      }));
      
      res.json({ success: true, data: assignments });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error getting courier assignments:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/*
  Respond to delivery assignment offer
  Handles acceptance/rejection of courier assignments with timeout management
*/
app.post('/api/couriers/assignments/:assignment_id/respond', authenticateToken, async (req, res) => {
  try {
    if (req.user.user_type !== 'courier') {
      return res.status(403).json({ success: false, message: 'Only couriers can respond to assignments' });
    }
    
    const { assignment_id } = req.params;
    const { response, decline_reason } = req.body;
    
    if (!response || !['accept', 'decline'].includes(response)) {
      return res.status(400).json({ success: false, message: 'Valid response (accept/decline) is required' });
    }
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Get assignment details
      const assignmentResult = await client.query(
        'SELECT * FROM order_assignments WHERE uid = $1 AND courier_id = $2 AND assignment_status = $3',
        [assignment_id, req.user.uid, 'pending']
      );
      
      if (assignmentResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Assignment not found or already responded' });
      }
      
      const assignment = assignmentResult.rows[0];
      
      // Check if response is within deadline
      if (new Date() > new Date(assignment.response_deadline)) {
        return res.status(400).json({ success: false, message: 'Response deadline has passed' });
      }
      
      if (response === 'accept') {
        // Update assignment status
        await client.query(
          'UPDATE order_assignments SET assignment_status = $1, accepted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE uid = $2',
          ['accepted', assignment_id]
        );
        
        // Update order with courier assignment
        await client.query(
          'UPDATE delivery_orders SET courier_id = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE uid = $3',
          [req.user.uid, 'courier_assigned', assignment.order_id]
        );
        
        // Update courier availability
        await client.query(
          'UPDATE courier_availability SET current_active_orders = current_active_orders + 1 WHERE courier_id = $1',
          [req.user.uid]
        );
        
        // Create status history
        const history_id = uuidv4();
        await client.query(
          'INSERT INTO order_status_history (uid, order_id, previous_status, new_status, changed_by, timestamp, additional_notes, created_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, CURRENT_TIMESTAMP)',
          [history_id, assignment.order_id, 'pending', 'courier_assigned', req.user.uid, 'Courier accepted assignment']
        );
        
        // Emit real-time update
        io.to(`order_${assignment.order_id}`).emit('order_status_change', {
          event: 'order_status_change',
          order_id: assignment.order_id,
          status: {
            current: 'courier_assigned',
            previous: 'pending',
            timestamp: new Date().toISOString()
          }
        });
        
      } else {
        // Update assignment as declined
        await client.query(
          'UPDATE order_assignments SET assignment_status = $1, declined_at = CURRENT_TIMESTAMP, decline_reason = $2, updated_at = CURRENT_TIMESTAMP WHERE uid = $3',
          ['declined', decline_reason, assignment_id]
        );
      }
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        data: {
          assignment_status: response === 'accept' ? 'accepted' : 'declined',
          order_id: assignment.order_id
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error responding to assignment:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// PAYMENT ENDPOINTS

/*
  Get user's payment methods
  Returns stored payment methods with masked sensitive data
*/
app.get('/api/payments/methods', authenticateToken, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT uid, payment_type, card_last_four, card_brand, card_exp_month, card_exp_year, is_default, is_active FROM payment_methods WHERE user_id = $1 AND is_active = 1 ORDER BY is_default DESC, created_at DESC',
        [req.user.uid]
      );
      
      const methods = result.rows.map(row => ({
        ...row,
        is_default: row.is_default === 1,
        is_active: row.is_active === 1
      }));
      
      res.json({ success: true, data: methods });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error getting payment methods:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/*
  Stripe payment processing for secure card tokenization and payment method storage
  Add new payment method with secure tokenization
*/
app.post('/api/payments/methods', authenticateToken, async (req, res) => {
  try {
    const {
      payment_type, card_number, card_exp_month, card_exp_year, card_cvc,
      billing_address, is_default = false
    } = req.body;
    
    if (!payment_type || !['credit_card', 'debit_card', 'paypal', 'apple_pay', 'google_pay'].includes(payment_type)) {
      return res.status(400).json({ success: false, message: 'Valid payment type is required' });
    }
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      let stripeCustomer;
      let paymentMethod;
      
      // Check if user has a Stripe customer ID
      const userQuery = await client.query(
        'SELECT uid FROM users WHERE uid = $1',
        [req.user.uid]
      );
      
      if (userQuery.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      
      // For non-card payment types, skip Stripe integration
      if (['paypal', 'apple_pay', 'google_pay'].includes(payment_type)) {
        // Mock payment method creation for digital wallets
        const payment_method_id = uuidv4();
        await client.query(
          'INSERT INTO payment_methods (uid, user_id, payment_type, card_last_four, card_brand, card_exp_month, card_exp_year, billing_address_id, gateway_customer_id, gateway_payment_method_id, is_default, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
          [payment_method_id, req.user.uid, payment_type, null, null, null, null, null, null, null, is_default ? 1 : 0, 1]
        );
        
        await client.query('COMMIT');
        
        return res.status(201).json({
          success: true,
          data: {
            uid: payment_method_id,
            payment_type,
            is_default,
            is_active: true
          }
        });
      }
      
      // For card payments, use Stripe
      if (process.env.STRIPE_SECRET_KEY && card_number) {
        try {
          // Create Stripe customer if needed
          stripeCustomer = await stripe.customers.create({
            metadata: {
              user_id: req.user.uid
            }
          });
          
          // Create payment method
          paymentMethod = await stripe.paymentMethods.create({
            type: 'card',
            card: {
              number: card_number,
              exp_month: parseInt(card_exp_month),
              exp_year: parseInt(card_exp_year),
              cvc: card_cvc,
            }
          });
          
          // Attach payment method to customer
          await stripe.paymentMethods.attach(paymentMethod.id, {
            customer: stripeCustomer.id,
          });
        } catch (stripeError) {
          console.error('Stripe error:', stripeError);
          // Fall back to mock for development
          paymentMethod = {
            id: 'pm_mock_' + Date.now(),
            card: {
              last4: card_number ? card_number.slice(-4) : '1234',
              brand: 'visa',
              exp_month: card_exp_month,
              exp_year: card_exp_year
            }
          };
          stripeCustomer = { id: 'cus_mock_' + Date.now() };
        }
      } else {
        // Mock for development
        paymentMethod = {
          id: 'pm_mock_' + Date.now(),
          card: {
            last4: card_number ? card_number.slice(-4) : '1234',
            brand: 'visa',
            exp_month: card_exp_month,
            exp_year: card_exp_year
          }
        };
        stripeCustomer = { id: 'cus_mock_' + Date.now() };
      }
      
      let billing_address_id = null;
      if (billing_address) {
        // Create billing address
        billing_address_id = uuidv4();
        const geocoding = await geocodeAddress(billing_address);
        await client.query(
          'INSERT INTO addresses (uid, street_address, apartment_unit, city, state, postal_code, country, latitude, longitude, is_residential, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
          [billing_address_id, billing_address.street_address, billing_address.apartment_unit, billing_address.city, billing_address.state, billing_address.postal_code, billing_address.country || 'USA', geocoding.latitude, geocoding.longitude, 1]
        );
      }
      
      // If this is default, unset other defaults
      if (is_default) {
        await client.query(
          'UPDATE payment_methods SET is_default = 0 WHERE user_id = $1',
          [req.user.uid]
        );
      }
      
      // Insert payment method
      const payment_method_id = uuidv4();
      await client.query(
        'INSERT INTO payment_methods (uid, user_id, payment_type, card_last_four, card_brand, card_exp_month, card_exp_year, billing_address_id, gateway_customer_id, gateway_payment_method_id, is_default, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [payment_method_id, req.user.uid, payment_type, paymentMethod.card.last4, paymentMethod.card.brand, paymentMethod.card.exp_month, paymentMethod.card.exp_year, billing_address_id, stripeCustomer.id, paymentMethod.id, is_default ? 1 : 0, 1]
      );
      
      await client.query('COMMIT');
      
      res.status(201).json({
        success: true,
        data: {
          uid: payment_method_id,
          payment_type,
          card_last_four: paymentMethod.card.last4,
          card_brand: paymentMethod.card.brand,
          card_exp_month: paymentMethod.card.exp_month,
          card_exp_year: paymentMethod.card.exp_year,
          is_default,
          is_active: true
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error adding payment method:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/*
  Process payment for delivery order
  Handles payment authorization and capture with gateway integration
*/
app.post('/api/payments/process', authenticateToken, async (req, res) => {
  try {
    const { order_id, payment_method_id, payment_method } = req.body;
    
    if (!order_id) {
      return res.status(400).json({ success: false, message: 'Order ID is required' });
    }
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Get order details
      const orderResult = await client.query(
        'SELECT * FROM delivery_orders WHERE uid = $1 AND sender_id = $2',
        [order_id, req.user.uid]
      );
      
      if (orderResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      
      const order = orderResult.rows[0];
      
      if (order.payment_status === 'paid') {
        return res.status(400).json({ success: false, message: 'Order is already paid' });
      }
      
      // Process payment through gateway
      const paymentResult = await processPaymentWithGateway({
        amount: order.total_amount,
        payment_method_id: payment_method_id || null,
        payment_method: payment_method || null,
        order_id,
        user_id: req.user.uid
      });
      
      if (paymentResult.status === 'completed') {
        // Update order payment status
        await client.query(
          'UPDATE delivery_orders SET payment_status = $1, updated_at = CURRENT_TIMESTAMP WHERE uid = $2',
          ['paid', order_id]
        );
        
        // Create payment record
        const payment_id = uuidv4();
        await client.query(
          'INSERT INTO payments (uid, order_id, user_id, payment_method_id, transaction_id, payment_gateway, payment_type, amount, currency, status, gateway_response, processed_at, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
          [payment_id, order_id, req.user.uid, payment_method_id, paymentResult.transaction_id, 'stripe', 'card', order.total_amount, 'USD', 'completed', paymentResult.gateway_response]
        );
        
        await client.query('COMMIT');
        
        // Emit payment status update
        io.to(`order_${order_id}`).emit('payment_status_update', {
          event: 'payment_status_update',
          order_id,
          payment_status: {
            status: 'completed',
            timestamp: new Date().toISOString(),
            transaction_id: paymentResult.transaction_id,
            amount: order.total_amount
          }
        });
        
        res.json({
          success: true,
          data: {
            payment_id,
            transaction_id: paymentResult.transaction_id,
            status: 'completed',
            amount: order.total_amount
          }
        });
      } else {
        await client.query('ROLLBACK');
        res.status(400).json({ success: false, message: 'Payment failed' });
      }
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// MESSAGING ENDPOINTS

/*
  Get messages for specific order
  Returns conversation history between all parties involved in delivery
*/
app.get('/api/messages/:order_id', authenticateToken, async (req, res) => {
  try {
    const { order_id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    const client = await pool.connect();
    try {
      // Verify user has access to this order
      const orderCheck = await client.query(
        'SELECT sender_id, courier_id FROM delivery_orders WHERE uid = $1',
        [order_id]
      );
      
      if (orderCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      
      const order = orderCheck.rows[0];
      if (order.sender_id !== req.user.uid && order.courier_id !== req.user.uid) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
      
      const result = await client.query(`
        SELECT m.*, 
               sender.first_name as sender_first_name, sender.last_name as sender_last_name,
               sender.user_type as sender_type, sender.profile_image_url as sender_image
        FROM messages m
        JOIN users sender ON m.sender_id = sender.uid
        WHERE m.order_id = $1
        ORDER BY m.sent_at DESC
        LIMIT $2 OFFSET $3
      `, [order_id, limit, offset]);
      
      const messages = result.rows.map(row => ({
        uid: row.uid,
        message_type: row.message_type,
        message_content: row.message_content,
        image_url: row.image_url,
        template_type: row.template_type,
        is_read: row.is_read === 1,
        sent_at: row.sent_at,
        sender: {
          user_id: row.sender_id,
          name: `${row.sender_first_name} ${row.sender_last_name}`,
          role: row.sender_type,
          profile_image_url: row.sender_image
        }
      }));
      
      // Mark messages as read for current user
      await client.query(
        'UPDATE messages SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE order_id = $1 AND recipient_id = $2 AND is_read = 0',
        [order_id, req.user.uid]
      );
      
      res.json({
        success: true,
        data: {
          messages,
          pagination: {
            current_page: parseInt(page),
            has_next: messages.length === parseInt(limit)
          }
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/*
  Send message for order
  Creates new message and triggers real-time delivery to recipients
*/
app.post('/api/messages/:order_id', authenticateToken, async (req, res) => {
  try {
    const { order_id } = req.params;
    const { recipient_id, message_type, message_content, image_url, template_type } = req.body;
    
    if (!recipient_id || !message_type || !message_content) {
      return res.status(400).json({ success: false, message: 'Recipient ID, message type, and content are required' });
    }
    
    const client = await pool.connect();
    try {
      // Verify user has access to this order
      const orderCheck = await client.query(
        'SELECT sender_id, courier_id FROM delivery_orders WHERE uid = $1',
        [order_id]
      );
      
      if (orderCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      
      const order = orderCheck.rows[0];
      if (order.sender_id !== req.user.uid && order.courier_id !== req.user.uid) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
      
      // Insert message
      const message_id = uuidv4();
      await client.query(
        'INSERT INTO messages (uid, order_id, sender_id, recipient_id, message_type, message_content, image_url, template_type, is_read, sent_at, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [message_id, order_id, req.user.uid, recipient_id, message_type, message_content, image_url, template_type, 0]
      );
      
      // Get sender info for real-time message
      const senderInfo = await client.query(
        'SELECT first_name, last_name, user_type, profile_image_url FROM users WHERE uid = $1',
        [req.user.uid]
      );
      
      const sender = senderInfo.rows[0];
      
      // Emit real-time message
      io.to(`order_${order_id}`).emit('message_received', {
        event: 'message_received',
        message_id,
        order_id,
        sender: {
          user_id: req.user.uid,
          name: `${sender.first_name} ${sender.last_name}`,
          role: sender.user_type,
          profile_image_url: sender.profile_image_url
        },
        message: {
          type: message_type,
          content: message_content,
          image_url,
          template_type,
          timestamp: new Date().toISOString()
        }
      });
      
      res.status(201).json({
        success: true,
        data: {
          message_id,
          sent_at: new Date().toISOString()
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// RATING ENDPOINTS

/*
  Submit rating for completed order
  Allows users to rate each other after delivery completion
*/
app.post('/api/ratings/:order_id', authenticateToken, async (req, res) => {
  try {
    const { order_id } = req.params;
    const {
      rated_id, overall_rating, professionalism_rating, speed_rating,
      communication_rating, package_handling_rating, written_feedback,
      is_anonymous = false, images = []
    } = req.body;
    
    if (!rated_id || !overall_rating) {
      return res.status(400).json({ success: false, message: 'Rated user ID and overall rating are required' });
    }
    
    if (overall_rating < 1 || overall_rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Verify order exists and user has access
      const orderResult = await client.query(
        'SELECT sender_id, courier_id, status FROM delivery_orders WHERE uid = $1',
        [order_id]
      );
      
      if (orderResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      
      const order = orderResult.rows[0];
      if (order.sender_id !== req.user.uid && order.courier_id !== req.user.uid) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
      
      if (order.status !== 'delivered') {
        return res.status(400).json({ success: false, message: 'Can only rate completed deliveries' });
      }
      
      // Check if rating already exists
      const existingRating = await client.query(
        'SELECT uid FROM ratings WHERE order_id = $1 AND rater_id = $2',
        [order_id, req.user.uid]
      );
      
      if (existingRating.rows.length > 0) {
        return res.status(400).json({ success: false, message: 'Rating already submitted for this order' });
      }
      
      // Determine rating type
      const rating_type = req.user.uid === order.sender_id ? 'sender_to_courier' : 'courier_to_sender';
      
      // Insert rating
      const rating_id = uuidv4();
      await client.query(
        'INSERT INTO ratings (uid, order_id, rater_id, rated_id, rating_type, overall_rating, professionalism_rating, speed_rating, communication_rating, package_handling_rating, written_feedback, is_anonymous, is_public, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [rating_id, order_id, req.user.uid, rated_id, rating_type, overall_rating, professionalism_rating, speed_rating, communication_rating, package_handling_rating, written_feedback, is_anonymous ? 1 : 0, 1]
      );
      
      // Insert rating images if provided
      for (const image_url of images) {
        const image_id = uuidv4();
        await client.query(
          'INSERT INTO rating_images (uid, rating_id, image_url, image_type, uploaded_at, created_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
          [image_id, rating_id, image_url, 'general']
        );
      }
      
      // Update user's average rating
      if (rating_type === 'sender_to_courier') {
        const avgResult = await client.query(
          "SELECT AVG(overall_rating) as avg_rating FROM ratings WHERE rated_id = $1 AND rating_type = 'sender_to_courier'",
          [rated_id]
        );
        
        await client.query(
          'UPDATE courier_profiles SET average_rating = $1 WHERE user_id = $2',
          [Math.round(avgResult.rows[0].avg_rating * 100) / 100, rated_id]
        );
      }
      
      await client.query('COMMIT');
      
      res.status(201).json({
        success: true,
        data: {
          rating_id,
          submitted_at: new Date().toISOString()
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error submitting rating:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/*
  Get user dashboard with comprehensive statistics
  Returns role-specific dashboard data with active orders and metrics
*/
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      if (req.user.user_type === 'sender') {
        // Get sender dashboard data
        const activeOrders = await client.query(`
          SELECT do.uid, do.order_number, do.status, do.urgency_level, do.total_amount,
                 do.estimated_delivery_time, do.created_at,
                 pa.street_address as pickup_address, pa.city as pickup_city,
                 da.street_address as delivery_address, da.city as delivery_city,
                 cu.first_name as courier_name, cp.average_rating as courier_rating
          FROM delivery_orders do
          LEFT JOIN addresses pa ON do.pickup_address_id = pa.uid
          LEFT JOIN addresses da ON do.delivery_address_id = da.uid
          LEFT JOIN users cu ON do.courier_id = cu.uid
          LEFT JOIN courier_profiles cp ON cu.uid = cp.user_id
          WHERE do.sender_id = $1 AND do.status NOT IN ('delivered', 'cancelled', 'failed')
          ORDER BY do.created_at DESC
          LIMIT 10
        `, [req.user.uid]);
        
        const recentOrders = await client.query(`
          SELECT do.uid, do.order_number, do.status, do.total_amount, do.actual_delivery_time, do.created_at,
                 pa.city as pickup_city, da.city as delivery_city
          FROM delivery_orders do
          LEFT JOIN addresses pa ON do.pickup_address_id = pa.uid
          LEFT JOIN addresses da ON do.delivery_address_id = da.uid
          WHERE do.sender_id = $1 AND do.status IN ('delivered', 'cancelled', 'failed')
          ORDER BY do.created_at DESC
          LIMIT 10
        `, [req.user.uid]);
        
        const stats = await client.query(`
          SELECT 
            COUNT(*) as total_orders,
            SUM(CASE WHEN status = 'delivered' THEN total_amount ELSE 0 END) as total_spent,
            AVG(CASE WHEN status = 'delivered' THEN total_amount ELSE NULL END) as avg_order_value,
            COUNT(CASE WHEN status NOT IN ('delivered', 'cancelled', 'failed') THEN 1 END) as active_orders_count,
            COUNT(CASE WHEN status = 'delivered' THEN 1 END) as completed_orders_count
          FROM delivery_orders 
          WHERE sender_id = $1
        `, [req.user.uid]);
        
        res.json({
          success: true,
          data: {
            user_type: 'sender',
            active_orders: activeOrders.rows,
            recent_orders: recentOrders.rows,
            stats: {
              total_orders: parseInt(stats.rows[0].total_orders),
              total_spent: parseFloat(stats.rows[0].total_spent) || 0,
              avg_order_value: parseFloat(stats.rows[0].avg_order_value) || 0,
              active_orders_count: parseInt(stats.rows[0].active_orders_count),
              completed_orders_count: parseInt(stats.rows[0].completed_orders_count)
            }
          }
        });
        
      } else if (req.user.user_type === 'courier') {
        // Get courier dashboard data
        const activeOrders = await client.query(`
          SELECT do.uid, do.order_number, do.status, do.urgency_level, do.courier_earnings,
                 do.estimated_pickup_time, do.estimated_delivery_time, do.created_at,
                 pa.street_address as pickup_address, pa.city as pickup_city,
                 da.street_address as delivery_address, da.city as delivery_city,
                 su.first_name as sender_name
          FROM delivery_orders do
          LEFT JOIN addresses pa ON do.pickup_address_id = pa.uid
          LEFT JOIN addresses da ON do.delivery_address_id = da.uid
          LEFT JOIN users su ON do.sender_id = su.uid
          WHERE do.courier_id = $1 AND do.status NOT IN ('delivered', 'cancelled', 'failed')
          ORDER BY do.created_at DESC
          LIMIT 10
        `, [req.user.uid]);
        
        const recentOrders = await client.query(`
          SELECT do.uid, do.order_number, do.status, do.courier_earnings, do.actual_delivery_time, do.created_at,
                 pa.city as pickup_city, da.city as delivery_city
          FROM delivery_orders do
          LEFT JOIN addresses pa ON do.pickup_address_id = pa.uid
          LEFT JOIN addresses da ON do.delivery_address_id = da.uid
          WHERE do.courier_id = $1 AND do.status IN ('delivered', 'cancelled', 'failed')
          ORDER BY do.created_at DESC
          LIMIT 10
        `, [req.user.uid]);
        
        const stats = await client.query(`
          SELECT 
            COUNT(*) as total_deliveries,
            SUM(CASE WHEN status = 'delivered' THEN courier_earnings ELSE 0 END) as total_earned,
            AVG(CASE WHEN status = 'delivered' THEN courier_earnings ELSE NULL END) as avg_earning_per_delivery
          FROM delivery_orders 
          WHERE courier_id = $1
        `, [req.user.uid]);
        
        const profileStats = await client.query(
          'SELECT average_rating, total_deliveries FROM courier_profiles WHERE user_id = $1',
          [req.user.uid]
        );
        
        res.json({
          success: true,
          data: {
            user_type: 'courier',
            active_orders: activeOrders.rows,
            recent_orders: recentOrders.rows,
            stats: {
              total_orders: parseInt(stats.rows[0].total_deliveries),
              total_earned: parseFloat(stats.rows[0].total_earned) || 0,
              avg_earning_per_delivery: parseFloat(stats.rows[0].avg_earning_per_delivery) || 0,
              average_rating: parseFloat(profileStats.rows[0]?.average_rating) || 0,
              active_orders_count: activeOrders.rows.length,
              completed_orders_count: parseInt(profileStats.rows[0]?.total_deliveries) || 0
            }
          }
        });
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error getting dashboard:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// FILE UPLOAD ENDPOINT

/*
  Generic file upload endpoint for various file types
  Handles secure file storage with type validation
*/
app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { file_type, order_id } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File is required' });
    }
    
    if (!file_type || !['profile_image', 'package_photo', 'document', 'driver_license'].includes(file_type)) {
      return res.status(400).json({ success: false, message: 'Valid file type is required' });
    }
    
    const file_url = `/uploads/${req.file.filename}`;
    
    res.status(201).json({
      success: true,
      data: {
        file_url,
        file_type,
        file_size: req.file.size,
        upload_timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// WEBSOCKET EVENT HANDLERS

/*
  WebSocket connection management and real-time event handling
  Manages room-based communication and event broadcasting
*/
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.user.uid} (${socket.user.user_type})`);
  
  // Join user to their personal room
  socket.join(`user_${socket.user.uid}`);
  
  // Join order rooms for orders user is involved in
  socket.on('join_order_room', async (data) => {
    const { order_id } = data;
    
    try {
      const client = await pool.connect();
      try {
        const result = await client.query(
          'SELECT sender_id, courier_id FROM delivery_orders WHERE uid = $1',
          [order_id]
        );
        
        if (result.rows.length > 0) {
          const order = result.rows[0];
          if (order.sender_id === socket.user.uid || order.courier_id === socket.user.uid) {
            socket.join(`order_${order_id}`);
            socket.emit('joined_room', { room: `order_${order_id}` });
          }
        }
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error joining order room:', error);
    }
  });
  
  // Handle courier assignment responses
  socket.on('courier_assignment_response', async (data) => {
    const { assignment_id, response, decline_reason } = data;
    
    if (socket.user.user_type !== 'courier') return;
    
    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        const assignmentResult = await client.query(
          'SELECT * FROM order_assignments WHERE uid = $1 AND courier_id = $2 AND assignment_status = $3',
          [assignment_id, socket.user.uid, 'pending']
        );
        
        if (assignmentResult.rows.length > 0) {
          const assignment = assignmentResult.rows[0];
          
          if (response === 'accept') {
            await client.query(
              'UPDATE order_assignments SET assignment_status = $1, accepted_at = CURRENT_TIMESTAMP WHERE uid = $2',
              ['accepted', assignment_id]
            );
            
            await client.query(
              'UPDATE delivery_orders SET courier_id = $1, status = $2 WHERE uid = $3',
              [socket.user.uid, 'courier_assigned', assignment.order_id]
            );
            
            // Emit to order room
            io.to(`order_${assignment.order_id}`).emit('order_status_change', {
              event: 'order_status_change',
              order_id: assignment.order_id,
              status: {
                current: 'courier_assigned',
                previous: 'pending',
                timestamp: new Date().toISOString()
              }
            });
          } else {
            await client.query(
              'UPDATE order_assignments SET assignment_status = $1, declined_at = CURRENT_TIMESTAMP, decline_reason = $2 WHERE uid = $3',
              ['declined', decline_reason, assignment_id]
            );
          }
          
          await client.query('COMMIT');
        }
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error handling courier assignment response:', error);
    }
  });
  
  // Handle location updates from couriers
  socket.on('location_update', async (data) => {
    const { order_id, location, accuracy, speed, heading, battery_level } = data;
    
    if (socket.user.user_type !== 'courier') return;
    
    try {
      const client = await pool.connect();
      try {
        // Insert location record
        const location_id = uuidv4();
        await client.query(
          'INSERT INTO location_tracking (uid, courier_id, order_id, latitude, longitude, accuracy, speed, heading, timestamp, battery_level, is_active_delivery, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, $9, $10, CURRENT_TIMESTAMP)',
          [location_id, socket.user.uid, order_id, location.latitude, location.longitude, accuracy, speed, heading, battery_level, order_id ? 1 : 0]
        );
        
        // Update courier profile location
        await client.query(
          'UPDATE courier_profiles SET current_location_lat = $1, current_location_lng = $2, last_location_update = CURRENT_TIMESTAMP WHERE user_id = $3',
          [location.latitude, location.longitude, socket.user.uid]
        );
        
        // Broadcast to order room
        if (order_id) {
          socket.to(`order_${order_id}`).emit('location_update', {
            event: 'location_update',
            order_id,
            courier: {
              location: {
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy,
                speed,
                heading
              },
              timestamp: new Date().toISOString(),
              battery_level
            }
          });
        }
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error handling location update:', error);
    }
  });
  
  // Handle sending messages
  socket.on('send_message', async (data) => {
    const { order_id, recipient_id, message_type, content, image_url, template_type } = data;
    
    try {
      const client = await pool.connect();
      try {
        // Verify access to order
        const orderCheck = await client.query(
          'SELECT sender_id, courier_id FROM delivery_orders WHERE uid = $1',
          [order_id]
        );
        
        if (orderCheck.rows.length > 0) {
          const order = orderCheck.rows[0];
          if (order.sender_id === socket.user.uid || order.courier_id === socket.user.uid) {
            // Insert message
            const message_id = uuidv4();
            await client.query(
              'INSERT INTO messages (uid, order_id, sender_id, recipient_id, message_type, message_content, image_url, template_type, is_read, sent_at, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
              [message_id, order_id, socket.user.uid, recipient_id, message_type, content, image_url, template_type, 0]
            );
            
            // Get sender info
            const senderInfo = await client.query(
              'SELECT first_name, last_name, user_type, profile_image_url FROM users WHERE uid = $1',
              [socket.user.uid]
            );
            
            const sender = senderInfo.rows[0];
            
            // Emit to order room
            io.to(`order_${order_id}`).emit('message_received', {
              event: 'message_received',
              message_id,
              order_id,
              sender: {
                user_id: socket.user.uid,
                name: `${sender.first_name} ${sender.last_name}`,
                role: sender.user_type,
                profile_image_url: sender.profile_image_url
              },
              message: {
                type: message_type,
                content,
                image_url,
                template_type,
                timestamp: new Date().toISOString()
              }
            });
          }
        }
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  });
  
  // Handle courier availability updates
  socket.on('courier_availability_update', async (data) => {
    const { availability_status, break_duration, current_location, shift_end_time } = data;
    
    if (socket.user.user_type !== 'courier') return;
    
    try {
      const client = await pool.connect();
      try {
        await client.query(
          'UPDATE courier_availability SET availability_status = $1, break_duration_minutes = $2, shift_end_time = $3, last_update = CURRENT_TIMESTAMP WHERE courier_id = $4',
          [availability_status, break_duration, shift_end_time, socket.user.uid]
        );
        
        if (current_location) {
          await client.query(
            'UPDATE courier_profiles SET current_location_lat = $1, current_location_lng = $2, last_location_update = CURRENT_TIMESTAMP WHERE user_id = $3',
            [current_location.latitude, current_location.longitude, socket.user.uid]
          );
        }
        
        // Broadcast availability change
        socket.broadcast.emit('courier_availability_status', {
          event: 'courier_availability_status',
          courier_id: socket.user.uid,
          availability: {
            is_available: availability_status === 'online',
            status: availability_status,
            last_update: new Date().toISOString()
          }
        });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error updating courier availability:', error);
    }
  });
  
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.user.uid}`);
  });
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'storage/uploads')));

// Catch-all route for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`QuickCourier server running on port ${PORT}`);
});