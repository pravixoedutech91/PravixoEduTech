const express = require("express");
const router = express.Router();

const Category = require("../models/Category");

// Create Category
router.post("/", async (req, res) => {
  try {
    console.log("Request Body:", req.body);

    const { name, slug, description } = req.body;

    const category = await Category.create({
      name,
      slug,
      description,
    });

    res.status(201).json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Get All Categories
router.get("/", async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;