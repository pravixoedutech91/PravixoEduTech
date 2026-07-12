const Category = require("../models/Category");
const {
  getTenantFilter,
} = require("../middleware/tenantMiddleware");

const PUBLIC_TENANT_ID =
  process.env.PUBLIC_TENANT_ID || "pravixoedutech";

const normalizeCategoryWriteData = (req) => {
  const data = {
    ...req.body,
  };

  delete data._id;
  delete data.createdAt;
  delete data.updatedAt;

  if (req.user?.role !== "super_admin") {
    data.tenantId = req.user.tenantId;
  } else {
    data.tenantId = data.tenantId || PUBLIC_TENANT_ID;
  }

  return data;
};

const normalizeCategoryUpdateData = (req) => {
  const data = {
    ...req.body,
  };

  delete data._id;
  delete data.createdAt;
  delete data.updatedAt;
  delete data.tenantId;

  return data;
};

const createCategory = async (req, res) => {
  try {
    const category = await Category.create(
      normalizeCategoryWriteData(req)
    );

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

const getPublicCategories = async (req, res) => {
  try {
    const categories = await Category.find({
      tenantId: PUBLIC_TENANT_ID,
      isActive: true,
    }).sort({
      name: 1,
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

const updateCategory = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);

    const category = await Category.findOneAndUpdate(
      {
        _id: req.params.id,
        ...tenantFilter,
      },
      normalizeCategoryUpdateData(req),
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
  getPublicCategories,
  getAllCategories,
  updateCategory,
  deleteCategory,
};
