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

module.exports = router;