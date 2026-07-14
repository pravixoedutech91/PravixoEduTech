const mongoose = require("mongoose");

const PaymentProduct = require("../models/PaymentProduct");
const MockTest = require("../models/MockTest");

const hasText = (value) => {
  return typeof value === "string" && value.trim().length > 0;
};

const createSlugFromText = (value) => {
  if (!hasText(value)) {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const toBoolean = (value, fallback) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
};

const toInteger = (value, fallback) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.trunc(parsed);
};

const isValidObjectId = (value) => {
  return mongoose.Types.ObjectId.isValid(String(value || ""));
};

const normalizeMockTestIds = (values) => {
  if (!Array.isArray(values)) {
    return null;
  }

  const ids = [];
  const seen = new Set();

  for (const value of values) {
    const id = String(value || "").trim();

    if (!isValidObjectId(id)) {
      return null;
    }

    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }

  return ids;
};

const getWriteTenantId = (req) => {
  if (req.user?.role === "super_admin") {
    return req.body?.tenantId || req.user?.tenantId;
  }

  return req.user?.tenantId;
};

const buildTenantFilter = (req) => {
  const filter = {};

  if (req.user?.role === "super_admin") {
    const tenantId = req.query?.tenantId || req.body?.tenantId;

    if (tenantId) {
      filter.tenantId = tenantId;
    }

    return filter;
  }

  filter.tenantId = req.user?.tenantId;
  return filter;
};

const buildProductFilter = (req) => {
  const filter = {
    _id: req.params.id,
  };

  if (req.user?.role === "super_admin") {
    const tenantId = req.query?.tenantId || req.body?.tenantId;

    if (tenantId) {
      filter.tenantId = tenantId;
    }

    return filter;
  }

  filter.tenantId = req.user?.tenantId;
  return filter;
};

const validateMockTestIdsForTenant = async (tenantId, mockTestIds) => {
  const ids = normalizeMockTestIds(mockTestIds);

  if (!ids || ids.length === 0) {
    return {
      error: "At least one mock test is required in a pack",
    };
  }

  const activeMockTestCount = await MockTest.countDocuments({
    _id: {
      $in: ids,
    },
    tenantId,
    isActive: {
      $ne: false,
    },
  });

  if (activeMockTestCount !== ids.length) {
    return {
      error: "One or more mock tests are invalid or inactive for this tenant",
    };
  }

  return {
    ids,
  };
};

const buildCreateData = async (req) => {
  const tenantId = String(getWriteTenantId(req) || "").trim();

  if (!hasText(tenantId)) {
    return {
      error: "Valid tenantId is required",
    };
  }

  const title = hasText(req.body?.title) ? req.body.title.trim() : "";
  const slug = createSlugFromText(req.body?.slug || title);
  const productType = req.body?.productType || "mock_test_pack";
  const priceInPaise = Number(req.body?.priceInPaise);
  const validityDays = toInteger(req.body?.validityDays, 365);
  const sortOrder = toInteger(req.body?.sortOrder, 0);

  if (!title) {
    return {
      error: "Package title is required",
    };
  }

  if (!slug) {
    return {
      error: "Package slug is required",
    };
  }

  if (productType !== "mock_test_pack") {
    return {
      error: "Only mock_test_pack products are supported currently",
    };
  }

  if (!Number.isFinite(priceInPaise) || priceInPaise < 0) {
    return {
      error: "Valid priceInPaise is required",
    };
  }

  if (validityDays < 1 || validityDays > 3650) {
    return {
      error: "Validity must be between 1 and 3650 days",
    };
  }

  const mockTestValidation = await validateMockTestIdsForTenant(
    tenantId,
    req.body?.includedMockTestIds
  );

  if (mockTestValidation.error) {
    return {
      error: mockTestValidation.error,
    };
  }

  return {
    data: {
      tenantId,
      title,
      slug,
      description: hasText(req.body?.description)
        ? req.body.description.trim()
        : "",
      productType,
      priceInPaise: Math.round(priceInPaise),
      currency: "INR",
      includedMockTestIds: mockTestValidation.ids,
      validityDays,
      isActive: toBoolean(req.body?.isActive, true),
      sortOrder,
      createdBy: req.user?._id,
      updatedBy: req.user?._id,
    },
  };
};

const buildUpdateData = async (req, product) => {
  const data = {};

  if (Object.prototype.hasOwnProperty.call(req.body, "title")) {
    if (!hasText(req.body.title)) {
      return {
        error: "Package title cannot be empty",
      };
    }

    data.title = req.body.title.trim();
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "slug")) {
    const slug = createSlugFromText(req.body.slug);

    if (!slug) {
      return {
        error: "Package slug cannot be empty",
      };
    }

    data.slug = slug;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "description")) {
    data.description = hasText(req.body.description)
      ? req.body.description.trim()
      : "";
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "productType")) {
    if (req.body.productType !== "mock_test_pack") {
      return {
        error: "Only mock_test_pack products are supported currently",
      };
    }

    data.productType = "mock_test_pack";
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "priceInPaise")) {
    const priceInPaise = Number(req.body.priceInPaise);

    if (!Number.isFinite(priceInPaise) || priceInPaise < 0) {
      return {
        error: "Valid priceInPaise is required",
      };
    }

    data.priceInPaise = Math.round(priceInPaise);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "validityDays")) {
    const validityDays = toInteger(req.body.validityDays, product.validityDays);

    if (validityDays < 1 || validityDays > 3650) {
      return {
        error: "Validity must be between 1 and 3650 days",
      };
    }

    data.validityDays = validityDays;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "includedMockTestIds")) {
    const mockTestValidation = await validateMockTestIdsForTenant(
      product.tenantId,
      req.body.includedMockTestIds
    );

    if (mockTestValidation.error) {
      return {
        error: mockTestValidation.error,
      };
    }

    data.includedMockTestIds = mockTestValidation.ids;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "isActive")) {
    data.isActive = toBoolean(req.body.isActive, product.isActive);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "sortOrder")) {
    data.sortOrder = toInteger(req.body.sortOrder, product.sortOrder);
  }

  data.updatedBy = req.user?._id;

  return {
    data,
  };
};

const getPaymentProducts = async (req, res) => {
  try {
    const page = Math.max(toInteger(req.query.page, 1), 1);
    const limit = Math.min(Math.max(toInteger(req.query.limit, 50), 1), 100);
    const skip = (page - 1) * limit;

    const filter = buildTenantFilter(req);

    if (req.query.productType) {
      filter.productType = req.query.productType;
    }

    if (req.query.isActive === "true") {
      filter.isActive = true;
    }

    if (req.query.isActive === "false") {
      filter.isActive = false;
    }

    if (hasText(req.query.search)) {
      const search = req.query.search.trim();

      filter.$or = [
        {
          title: {
            $regex: search,
            $options: "i",
          },
        },
        {
          slug: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    const [total, products] = await Promise.all([
      PaymentProduct.countDocuments(filter),
      PaymentProduct.find(filter)
        .populate("includedMockTestIds", "title slug accessType isPublished isActive")
        .sort({
          sortOrder: 1,
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit),
    ]);

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: products,
    });
  } catch (error) {
    console.error("Get payment products error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch payment products",
    });
  }
};

const getPaymentProductById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid package ID",
      });
    }

    const product = await PaymentProduct.findOne(buildProductFilter(req))
      .populate("includedMockTestIds", "title slug accessType isPublished isActive");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Payment product not found or access denied",
      });
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error("Get payment product error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch payment product",
    });
  }
};

const createPaymentProduct = async (req, res) => {
  try {
    const result = await buildCreateData(req);

    if (result.error) {
      return res.status(400).json({
        success: false,
        message: result.error,
      });
    }

    const product = await PaymentProduct.create(result.data);

    res.status(201).json({
      success: true,
      message: "Payment product created successfully",
      data: product,
    });
  } catch (error) {
    console.error("Create payment product error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A payment product with this slug already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create payment product",
    });
  }
};

const updatePaymentProduct = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid package ID",
      });
    }

    const product = await PaymentProduct.findOne(buildProductFilter(req));

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Payment product not found or access denied",
      });
    }

    const result = await buildUpdateData(req, product);

    if (result.error) {
      return res.status(400).json({
        success: false,
        message: result.error,
      });
    }

    Object.assign(product, result.data);
    await product.save();

    res.status(200).json({
      success: true,
      message: "Payment product updated successfully",
      data: product,
    });
  } catch (error) {
    console.error("Update payment product error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A payment product with this slug already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update payment product",
    });
  }
};

const disablePaymentProduct = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid package ID",
      });
    }

    const product = await PaymentProduct.findOneAndUpdate(
      buildProductFilter(req),
      {
        isActive: false,
        updatedBy: req.user?._id,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Payment product not found or access denied",
      });
    }

    res.status(200).json({
      success: true,
      message: "Payment product disabled successfully",
      data: product,
    });
  } catch (error) {
    console.error("Disable payment product error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to disable payment product",
    });
  }
};

const reactivatePaymentProduct = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid package ID",
      });
    }

    const product = await PaymentProduct.findOneAndUpdate(
      buildProductFilter(req),
      {
        isActive: true,
        updatedBy: req.user?._id,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Payment product not found or access denied",
      });
    }

    res.status(200).json({
      success: true,
      message: "Payment product reactivated successfully",
      data: product,
    });
  } catch (error) {
    console.error("Reactivate payment product error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to reactivate payment product",
    });
  }
};

module.exports = {
  getPaymentProducts,
  getPaymentProductById,
  createPaymentProduct,
  updatePaymentProduct,
  disablePaymentProduct,
  reactivatePaymentProduct,
};
