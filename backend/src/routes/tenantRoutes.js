const express = require("express");
const router = express.Router();

const {
  createTenant,
  getAllTenants,
} = require("../controllers/tenantController");

// Create Tenant
router.post("/", createTenant);

// Get All Tenants
router.get("/", getAllTenants);

module.exports = router;