const Content = require("../models/Content");
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

  return filter;
};

const getPublicLimit = (req) => {
  const requestedLimit = Number(req.query?.limit || 50);

  if (!Number.isFinite(requestedLimit) || requestedLimit <= 0) {
    return 50;
  }

  return Math.min(requestedLimit, 100);
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
    const content = await Content.create(
      normalizeContentWriteData(req)
    );

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
    const contents = await Content.find(getPublicContentFilter(req))
      .select("-content")
      .populate("category", "name slug description icon isActive")
      .sort({
        publishedAt: -1,
        createdAt: -1,
      })
      .limit(getPublicLimit(req));

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

    const content = await Content.findOneAndUpdate(
      {
        _id: req.params.id,
        ...tenantFilter,
      },
      normalizeContentUpdateData(req),
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
