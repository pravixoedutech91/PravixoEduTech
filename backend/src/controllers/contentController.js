const mongoose = require("mongoose");
const Content = require("../models/Content");
const Category = require("../models/Category");
const {
  getTenantFilter,
} = require("../middleware/tenantMiddleware");

const PUBLIC_TENANT_ID =
  process.env.PUBLIC_TENANT_ID || "pravixoedutech";

const ALLOWED_CONTENT_TYPES = [
  "article",
  "study_note",
  "notification",
  "current_affairs",
  "vacancy",
  "admit_card",
  "result",
  "syllabus",
  "exam_page",
];

const SEARCHABLE_PUBLIC_FIELDS = [
  "title",
  "slug",
  "summary",
  "content",
  "seoTitle",
  "seoDescription",
  "tags",
  "type",
];

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getPublicSearchWords = (req) => {
  const query =
    typeof req.query?.q === "string"
      ? req.query.q.trim()
      : "";

  if (!query) {
    return [];
  }

  return query
    .slice(0, 100)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .map(escapeRegex);
};

const getPublicContentFilter = (req) => {
  const filter = {
    tenantId: PUBLIC_TENANT_ID,
    status: "published",
  };

  if (
    req.query?.type &&
    ALLOWED_CONTENT_TYPES.includes(req.query.type)
  ) {
    filter.type = req.query.type;
  }

  if (req.query?.tag) {
    filter.tags = req.query.tag;
  }

  const searchWords = getPublicSearchWords(req);

  if (searchWords.length > 0) {
    filter.$and = searchWords.map((word) => ({
      $or: SEARCHABLE_PUBLIC_FIELDS.map((field) => ({
        [field]: {
          $regex: word,
          $options: "i",
        },
      })),
    }));
  }

  return filter;
};

const getPublicPagination = (req) => {
  const requestedPage = Number(req.query?.page || 1);
  const requestedLimit = Number(req.query?.limit || 50);

  const page =
    Number.isInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

  const limit =
    Number.isInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 100)
      : 50;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

const validateCategoryAccess = async (
  categoryId,
  tenantId
) => {
  if (!categoryId) {
    return {
      success: false,
      message: "Category is required",
    };
  }

  if (
    !mongoose.Types.ObjectId.isValid(categoryId)
  ) {
    return {
      success: false,
      message: "Invalid category ID",
    };
  }

  const category = await Category.findOne({
    _id: categoryId,
    tenantId,
  });

  if (!category) {
    return {
      success: false,
      message:
        "Category not found or access denied",
    };
  }

  return {
    success: true,
  };
};

const normalizeContentWriteData = (req) => {
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

  if (data.status === "published" && !data.publishedAt) {
    data.publishedAt = new Date();
  }

  return data;
};

const normalizeContentUpdateData = (req) => {
  const data = {
    ...req.body,
  };

  delete data._id;
  delete data.createdAt;
  delete data.updatedAt;
  delete data.tenantId;

  if (data.status === "published" && !data.publishedAt) {
    data.publishedAt = new Date();
  }

  return data;
};

const createContent = async (req, res) => {
  try {
    const contentData =
      normalizeContentWriteData(req);

    const categoryValidation =
      await validateCategoryAccess(
        contentData.category,
        contentData.tenantId
      );

    if (!categoryValidation.success) {
      return res.status(400).json({
        success: false,
        message: categoryValidation.message,
      });
    }

    const content =
      await Content.create(contentData);

    res.status(201).json({
      success: true,
      data: content,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getPublicContentList = async (req, res) => {
  try {
    const filter = getPublicContentFilter(req);
    const { page, limit, skip } =
      getPublicPagination(req);

    const [contents, total] = await Promise.all([
      Content.find(filter)
        .select("-content")
        .populate(
          "category",
          "name slug description icon isActive"
        )
        .sort({
          publishedAt: -1,
          createdAt: -1,
          _id: -1,
        })
        .skip(skip)
        .limit(limit),
      Content.countDocuments(filter),
    ]);

    const totalPages =
      total === 0 ? 0 : Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      count: contents.length,
      total,
      page,
      limit,
      totalPages,
      hasMore: skip + contents.length < total,
      data: contents,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getPublicContentBySlug = async (req, res) => {
  try {
    const content = await Content.findOne({
      tenantId: PUBLIC_TENANT_ID,
      slug: req.params.slug,
      status: "published",
    }).populate("category", "name slug description icon isActive");

    if (!content) {
      return res.status(404).json({
        success: false,
        message: "Content not found",
      });
    }

    res.status(200).json({
      success: true,
      data: content,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getAllContent = getPublicContentList;

const getContentBySlug = getPublicContentBySlug;

const updateContent = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);

    const existingContent =
      await Content.findOne({
        _id: req.params.id,
        ...tenantFilter,
      }).select("_id tenantId");

    if (!existingContent) {
      return res.status(404).json({
        success: false,
        message:
          "Content not found or access denied",
      });
    }

    const updateData =
      normalizeContentUpdateData(req);

    if (
      Object.prototype.hasOwnProperty.call(
        updateData,
        "category"
      )
    ) {
      const categoryValidation =
        await validateCategoryAccess(
          updateData.category,
          existingContent.tenantId
        );

      if (!categoryValidation.success) {
        return res.status(400).json({
          success: false,
          message:
            categoryValidation.message,
        });
      }
    }

    const content =
      await Content.findOneAndUpdate(
        {
          _id: req.params.id,
          ...tenantFilter,
        },
        updateData,
        {
        new: true,
        runValidators: true,
      }
    );

    if (!content) {
      return res.status(404).json({
        success: false,
        message: "Content not found or access denied",
      });
    }

    res.status(200).json({
      success: true,
      data: content,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteContent = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);

    const content = await Content.findOneAndDelete({
      _id: req.params.id,
      ...tenantFilter,
    });

    if (!content) {
      return res.status(404).json({
        success: false,
        message: "Content not found or access denied",
      });
    }

    res.status(200).json({
      success: true,
      message: "Content deleted successfully",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getAdminContentList = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);

    const contents = await Content.find(tenantFilter)
      .populate("category", "name slug description icon isActive")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: contents.length,
      data: contents,
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
  createContent,
  getAllContent,
  getContentBySlug,
  getPublicContentList,
  getPublicContentBySlug,
  updateContent,
  deleteContent,
  getAdminContentList,
};
