const Category = require("../models/Category");
const {
  getTenantFilter,
} = require("../middleware/tenantMiddleware");

// Create Category
const createCategory = async (req, res) => {
  try {
    const category = await Category.create(req.body);

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
};

// Get All Categories
const getAllCategories = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);

    const categories = await Category.find(tenantFilter).sort({
      createdAt: -1,
    });

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
};

// Update Category
const updateCategory = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);

    const category = await Category.findOneAndUpdate(
      {
        _id: req.params.id,
        ...tenantFilter,
      },
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found or access denied",
      });
    }

    res.status(200).json({
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
};


// Delete Category
const deleteCategory = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);

    const category = await Category.findOneAndDelete({
      _id: req.params.id,
      ...tenantFilter,
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found or access denied",
      });
    }

    res.status(200).json({
      success: true,
      message: "Category deleted successfully",
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
  createCategory,
  getAllCategories,
  updateCategory,
  deleteCategory,
};