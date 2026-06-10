const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");

const generateToken = (user, sessionId) => {
  return jwt.sign(
    {
      id: user._id,
      tenantId: user.tenantId,
      role: user.role,
      sessionId,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

// Register User
const registerUser = async (req, res) => {
  try {
    const { name, mobile, email, password, tenantId } = req.body;

    const existingUser = await User.findOne({
      $or: [{ mobile }, { email }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this mobile or email",
      });
    }

    const user = await User.create({
      name,
      mobile,
      email,
      password,
      tenantId: tenantId || "pravixoedutech",
      role: "student",
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        id: user._id,
        name: user.name,
        mobile: user.mobile,
        email: user.email,
        tenantId: user.tenantId,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Login User
const loginUser = async (req, res) => {
  try {
    const { login, password, deviceInfo } = req.body;

    const user = await User.findOne({
      $or: [{ mobile: login }, { email: login }],
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid login credentials",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is inactive",
      });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid login credentials",
      });
    }

    const sessionId = crypto.randomUUID();

    user.activeSessionId = sessionId;
    user.lastLoginAt = new Date();
    user.lastLoginDevice = deviceInfo || "";
    await user.save();

    const token = generateToken(user, sessionId);

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      data: {
        id: user._id,
        name: user.name,
        mobile: user.mobile,
        email: user.email,
        tenantId: user.tenantId,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Logged In User Profile
const getMe = async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      id: req.user._id,
      name: req.user.name,
      mobile: req.user.mobile,
      email: req.user.email,
      tenantId: req.user.tenantId,
      role: req.user.role,
    },
  });
};
// Create Initial Super Admin (Development Only)
const createSuperAdmin = async (req, res) => {
  try {
    const existingAdmin = await User.findOne({
      role: "super_admin",
    });

    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: "Super Admin already exists",
      });
    }

    const admin = await User.create({
      name: "Pravixo Super Admin",
      mobile: "9999999999",
      email: "admin@pravixo.com",
      password: "Admin@123",
      role: "super_admin",
      tenantId: "pravixoedutech",
      isEmailVerified: true,
    });

    res.status(201).json({
      success: true,
      message: "Super Admin created successfully",
      data: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
module.exports = {
  registerUser,
  loginUser,
  getMe,
  createSuperAdmin,
};