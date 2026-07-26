const {
  getInternalErrorMessage,
  logRuntimeError,
} = require("../utils/runtimeSecurity");
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
    logRuntimeError("tenantController error:", error);

    res.status(500).json({
      success: false,
      message: getInternalErrorMessage(error),
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
    logRuntimeError("tenantController error:", error);

    res.status(500).json({
      success: false,
      message: getInternalErrorMessage(error),
    });
  }
};

// Update Tenant
const updateTenant = async (req, res) => {
  try {
    const existingTenant = await Tenant.findById(req.params.id);

    if (!existingTenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
      });
    }

    const updateData = {
      ...req.body,
    };

    delete updateData._id;
    delete updateData.__v;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    if (updateData.features) {
      const existingFeatures =
        existingTenant.features && existingTenant.features.toObject
          ? existingTenant.features.toObject()
          : existingTenant.features || {};

      updateData.features = {
        ...existingFeatures,
        ...updateData.features,
      };
    }

    if (updateData.limits) {
      const existingLimits =
        existingTenant.limits && existingTenant.limits.toObject
          ? existingTenant.limits.toObject()
          : existingTenant.limits || {};

      updateData.limits = {
        ...existingLimits,
        ...updateData.limits,
      };
    }

    const tenant = await Tenant.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    res.status(200).json({
      success: true,
      data: tenant,
    });
  } catch (error) {
    logRuntimeError("tenantController error:", error);

    res.status(500).json({
      success: false,
      message: getInternalErrorMessage(error),
    });
  }
};

module.exports = {
  createTenant,
  getAllTenants,
  updateTenant,
};