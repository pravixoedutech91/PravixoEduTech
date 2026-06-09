const Tenant = require("../models/Tenant");

// Create Tenant
const createTenant = async (req, res) => {
  try {
    const tenant = await Tenant.create(req.body);

    res.status(201).json({
      success: true,
      data: tenant,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get All Tenants
const getAllTenants = async (req, res) => {
  try {
    const tenants = await Tenant.find().sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      count: tenants.length,
      data: tenants,
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
  createTenant,
  getAllTenants,
};