const {
  getInternalErrorMessage,
  logRuntimeError,
} = require("../utils/runtimeSecurity");
const mongoose = require("mongoose");

const TaxonomyNode = require("../models/TaxonomyNode");
const MockTest = require("../models/MockTest");

const hasOwn = (value, key) =>
  Object.prototype.hasOwnProperty.call(value || {}, key);

const hasText = (value) =>
  typeof value === "string" && value.trim().length > 0;

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const editableFields = [
  "slug",
  "nameEn",
  "nameHi",
  "aliasesEn",
  "aliasesHi",
  "descriptionEn",
  "descriptionHi",
  "order",
];

const immutableUpdateFields = [
  "_id",
  "__v",
  "tenantId",
  "kind",
  "parentId",
  "canonicalKey",
  "createdBy",
  "createdAt",
  "updatedAt",
  "isActive",
];

const forbiddenCreateFields = [
  "_id",
  "__v",
  "kind",
  "parentId",
  "canonicalKey",
  "createdBy",
  "updatedBy",
  "createdAt",
  "updatedAt",
  "isActive",
];

const getRequestTenantId = (req) => {
  if (req.user?.role === "super_admin") {
    return (
      req.body?.tenantId ||
      req.query?.tenantId ||
      req.user?.tenantId
    );
  }

  return req.user?.tenantId;
};

const getForbiddenField = (body, fields) => {
  for (const field of fields) {
    if (hasOwn(body, field)) {
      return field;
    }
  }

  return null;
};

const normalizeEditableData = (body = {}) => {
  const data = {};

  for (const field of editableFields) {
    if (hasOwn(body, field)) {
      data[field] = body[field];
    }
  }

  if (hasOwn(data, "slug")) {
    data.slug =
      typeof data.slug === "string"
        ? data.slug.trim().toLowerCase()
        : data.slug;
  }

  for (const field of [
    "nameEn",
    "nameHi",
    "descriptionEn",
    "descriptionHi",
  ]) {
    if (
      hasOwn(data, field) &&
      typeof data[field] === "string"
    ) {
      data[field] = data[field].trim();
    }
  }

  for (const field of ["aliasesEn", "aliasesHi"]) {
    if (
      hasOwn(data, field) &&
      Array.isArray(data[field])
    ) {
      data[field] = data[field]
        .map((value) =>
          typeof value === "string"
            ? value.trim()
            : value
        )
        .filter((value) => value !== "");
    }
  }

  if (hasOwn(data, "order")) {
    data.order = Number(data.order);
  }

  return data;
};

const validateEditableData = (data) => {
  if (!hasText(data.slug)) {
    return "Exam taxonomy slug is required";
  }

  if (!slugPattern.test(data.slug)) {
    return "Exam taxonomy slug must contain only lowercase letters, numbers, and single hyphens";
  }

  const hasEnglishName = hasText(data.nameEn);
  const hasHindiName = hasText(data.nameHi);

  if (!hasEnglishName && !hasHindiName) {
    return "At least one English or Hindi name is required";
  }

  for (const field of [
    "nameEn",
    "nameHi",
    "descriptionEn",
    "descriptionHi",
  ]) {
    if (
      data[field] !== undefined &&
      typeof data[field] !== "string"
    ) {
      return `${field} must be a string`;
    }
  }

  for (const field of ["aliasesEn", "aliasesHi"]) {
    if (data[field] !== undefined) {
      if (!Array.isArray(data[field])) {
        return `${field} must be an array`;
      }

      if (
        data[field].some(
          (value) => typeof value !== "string"
        )
      ) {
        return `${field} must contain only strings`;
      }
    }
  }

  if (
    data.order !== undefined &&
    (
      !Number.isFinite(data.order) ||
      data.order < 0
    )
  ) {
    return "Exam taxonomy order must be a non-negative number";
  }

  return null;
};

const buildExamFamilyCanonicalKey = (slug) =>
  `exam_family:${slug}`;

const buildExamCanonicalKey = (familyId, slug) =>
  `exam:${String(familyId)}:${slug}`;

const getValidationErrorMessage = (error) => {
  const validationErrors =
    error &&
    error.errors &&
    typeof error.errors === "object"
      ? Object.values(error.errors)
      : [];

  const firstMessage =
    validationErrors[0]?.message;

  return hasText(firstMessage)
    ? firstMessage
    : "Exam taxonomy validation failed";
};

const handleControllerError = (
  res,
  error,
  context
) => {
  if (error?.code === 11000) {
    return res.status(400).json({
      success: false,
      message:
        "Exam taxonomy slug or canonical key already exists for this organization",
    });
  }

  if (error?.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: getValidationErrorMessage(error),
    });
  }

  logRuntimeError(
    `examTaxonomyController ${context} error:`,
    error
  );

  return res.status(500).json({
    success: false,
    message: getInternalErrorMessage(error),
  });
};

const serializeNode = (node) => {
  const value =
    node && typeof node.toObject === "function"
      ? node.toObject()
      : node;

  return {
    _id: value._id,
    kind: value.kind,
    parentId: value.parentId || null,
    canonicalKey: value.canonicalKey,
    slug: value.slug,
    nameEn: value.nameEn,
    nameHi: value.nameHi,
    aliasesEn: value.aliasesEn || [],
    aliasesHi: value.aliasesHi || [],
    descriptionEn: value.descriptionEn,
    descriptionHi: value.descriptionHi,
    order: value.order,
    isActive: value.isActive,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
};

const compareNodes = (left, right) => {
  const leftOrder = Number(left.order || 0);
  const rightOrder = Number(right.order || 0);

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  const leftName =
    left.nameEn ||
    left.nameHi ||
    left.slug ||
    "";

  const rightName =
    right.nameEn ||
    right.nameHi ||
    right.slug ||
    "";

  return String(leftName).localeCompare(
    String(rightName)
  );
};

const validateObjectId = (
  value,
  label = "exam taxonomy ID"
) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return `Invalid ${label}`;
  }

  return null;
};

const requireTenantId = (req, res) => {
  const tenantId = getRequestTenantId(req);

  if (!hasText(tenantId)) {
    res.status(400).json({
      success: false,
      message:
        "Organization context is required for exam taxonomy management",
    });

    return null;
  }

  return tenantId;
};

// --------------------------------------------------
// Get exam taxonomy tree
// --------------------------------------------------

const getExamTaxonomyTree = async (req, res) => {
  try {
    const tenantId =
      requireTenantId(req, res);

    if (!tenantId) {
      return;
    }

    const includeInactive =
      req.query.includeInactive === "true";

    const filter = {
      tenantId,
      kind: {
        $in: ["exam_family", "exam"],
      },
    };

    if (!includeInactive) {
      filter.isActive = true;
    }

    const nodes = await TaxonomyNode.find(
      filter
    )
      .sort({
        order: 1,
        nameEn: 1,
        nameHi: 1,
        createdAt: 1,
      })
      .lean();

    const familyMap = new Map();
    const families = [];

    for (const node of nodes) {
      if (node.kind !== "exam_family") {
        continue;
      }

      const family = {
        ...serializeNode(node),
        exams: [],
      };

      familyMap.set(
        String(node._id),
        family
      );

      families.push(family);
    }

    let attachedExamCount = 0;

    for (const node of nodes) {
      if (node.kind !== "exam") {
        continue;
      }

      const family =
        familyMap.get(
          String(node.parentId || "")
        );

      if (!family) {
        continue;
      }

      family.exams.push(
        serializeNode(node)
      );

      attachedExamCount += 1;
    }

    families.sort(compareNodes);

    for (const family of families) {
      family.exams.sort(compareNodes);
    }

    return res.status(200).json({
      success: true,
      count: families.length,
      examCount: attachedExamCount,
      data: families,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "getExamTaxonomyTree"
    );
  }
};

// --------------------------------------------------
// Create exam family
// --------------------------------------------------

const createExamFamily = async (req, res) => {
  try {
    const tenantId =
      requireTenantId(req, res);

    if (!tenantId) {
      return;
    }

    const forbiddenField =
      getForbiddenField(
        req.body,
        forbiddenCreateFields
      );

    if (forbiddenField) {
      return res.status(400).json({
        success: false,
        message:
          `${forbiddenField} cannot be supplied when creating an exam family`,
      });
    }

    const data =
      normalizeEditableData(req.body);

    const validationError =
      validateEditableData(data);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const examFamily =
      await TaxonomyNode.create({
        ...data,
        tenantId,
        kind: "exam_family",
        parentId: null,
        canonicalKey:
          buildExamFamilyCanonicalKey(
            data.slug
          ),
        createdBy: req.user._id,
      });

    return res.status(201).json({
      success: true,
      data: serializeNode(examFamily),
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "createExamFamily"
    );
  }
};

// --------------------------------------------------
// Update exam family metadata
// --------------------------------------------------

const updateExamFamily = async (req, res) => {
  try {
    const idError =
      validateObjectId(
        req.params.familyId,
        "exam family ID"
      );

    if (idError) {
      return res.status(400).json({
        success: false,
        message: idError,
      });
    }

    const tenantId =
      requireTenantId(req, res);

    if (!tenantId) {
      return;
    }

    const forbiddenField =
      getForbiddenField(
        req.body,
        immutableUpdateFields
      );

    if (forbiddenField) {
      return res.status(400).json({
        success: false,
        message:
          `${forbiddenField} cannot be updated through the exam family metadata endpoint`,
      });
    }

    const updateData =
      normalizeEditableData(req.body);

    if (
      Object.keys(updateData).length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "No editable exam family fields were provided",
      });
    }

    const existingExamFamily =
      await TaxonomyNode.findOne({
        _id: req.params.familyId,
        tenantId,
        kind: "exam_family",
      });

    if (!existingExamFamily) {
      return res.status(404).json({
        success: false,
        message:
          "Exam family not found or access denied",
      });
    }

    const mergedData = {
      ...existingExamFamily.toObject(),
      ...updateData,
    };

    const validationError =
      validateEditableData(mergedData);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const examFamily =
      await TaxonomyNode.findOneAndUpdate(
        {
          _id: req.params.familyId,
          tenantId,
          kind: "exam_family",
        },
        {
          ...updateData,
          updatedBy: req.user._id,
        },
        {
          new: true,
          runValidators: true,
        }
      );

    return res.status(200).json({
      success: true,
      data: serializeNode(examFamily),
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "updateExamFamily"
    );
  }
};

// --------------------------------------------------
// Set exam family active status
// --------------------------------------------------

const setExamFamilyStatus = async (
  req,
  res
) => {
  try {
    const idError =
      validateObjectId(
        req.params.familyId,
        "exam family ID"
      );

    if (idError) {
      return res.status(400).json({
        success: false,
        message: idError,
      });
    }

    if (typeof req.body?.isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message:
          "isActive must be provided as a boolean",
      });
    }

    const tenantId =
      requireTenantId(req, res);

    if (!tenantId) {
      return;
    }

    const examFamily =
      await TaxonomyNode.findOne({
        _id: req.params.familyId,
        tenantId,
        kind: "exam_family",
      });

    if (!examFamily) {
      return res.status(404).json({
        success: false,
        message:
          "Exam family not found or access denied",
      });
    }

    const targetStatus =
      req.body.isActive;

    if (
      targetStatus === false &&
      examFamily.isActive !== false
    ) {
      const childExams =
        await TaxonomyNode.find({
          tenantId,
          kind: "exam",
          parentId: examFamily._id,
        })
          .select("_id isActive")
          .lean();

      if (
        childExams.some(
          (exam) => exam.isActive === true
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Deactivate all active exams in this family before deactivating the exam family",
        });
      }

      const childExamIds =
        childExams.map(
          (exam) => exam._id
        );

      if (childExamIds.length > 0) {
        const referencedMockTest =
          await MockTest.exists({
            tenantId,
            isActive: true,
            examTaxonomyNodeId: {
              $in: childExamIds,
            },
          });

        if (referencedMockTest) {
          return res.status(400).json({
            success: false,
            message:
              "This exam family cannot be deactivated while active mock tests reference its exams",
          });
        }
      }
    }

    examFamily.isActive =
      targetStatus;

    examFamily.updatedBy =
      req.user._id;

    await examFamily.save();

    return res.status(200).json({
      success: true,
      message: targetStatus
        ? "Exam family activated successfully"
        : "Exam family deactivated successfully",
      data: serializeNode(examFamily),
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "setExamFamilyStatus"
    );
  }
};

// --------------------------------------------------
// Create exam under family
// --------------------------------------------------

const createExam = async (req, res) => {
  try {
    const idError =
      validateObjectId(
        req.params.familyId,
        "exam family ID"
      );

    if (idError) {
      return res.status(400).json({
        success: false,
        message: idError,
      });
    }

    const tenantId =
      requireTenantId(req, res);

    if (!tenantId) {
      return;
    }

    const forbiddenField =
      getForbiddenField(
        req.body,
        forbiddenCreateFields
      );

    if (forbiddenField) {
      return res.status(400).json({
        success: false,
        message:
          `${forbiddenField} cannot be supplied when creating an exam`,
      });
    }

    const examFamily =
      await TaxonomyNode.findOne({
        _id: req.params.familyId,
        tenantId,
        kind: "exam_family",
        isActive: true,
      });

    if (!examFamily) {
      return res.status(404).json({
        success: false,
        message:
          "Active exam family not found or access denied",
      });
    }

    const data =
      normalizeEditableData(req.body);

    const validationError =
      validateEditableData(data);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const exam =
      await TaxonomyNode.create({
        ...data,
        tenantId,
        kind: "exam",
        parentId: examFamily._id,
        canonicalKey:
          buildExamCanonicalKey(
            examFamily._id,
            data.slug
          ),
        createdBy: req.user._id,
      });

    return res.status(201).json({
      success: true,
      data: serializeNode(exam),
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "createExam"
    );
  }
};

// --------------------------------------------------
// Update exam metadata
// --------------------------------------------------

const updateExam = async (req, res) => {
  try {
    const idError =
      validateObjectId(
        req.params.examId,
        "exam ID"
      );

    if (idError) {
      return res.status(400).json({
        success: false,
        message: idError,
      });
    }

    const tenantId =
      requireTenantId(req, res);

    if (!tenantId) {
      return;
    }

    const forbiddenField =
      getForbiddenField(
        req.body,
        immutableUpdateFields
      );

    if (forbiddenField) {
      return res.status(400).json({
        success: false,
        message:
          `${forbiddenField} cannot be updated through the exam metadata endpoint`,
      });
    }

    const updateData =
      normalizeEditableData(req.body);

    if (
      Object.keys(updateData).length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "No editable exam fields were provided",
      });
    }

    const existingExam =
      await TaxonomyNode.findOne({
        _id: req.params.examId,
        tenantId,
        kind: "exam",
      });

    if (!existingExam) {
      return res.status(404).json({
        success: false,
        message:
          "Exam not found or access denied",
      });
    }

    const examFamily =
      await TaxonomyNode.findOne({
        _id: existingExam.parentId,
        tenantId,
        kind: "exam_family",
      });

    if (!examFamily) {
      return res.status(400).json({
        success: false,
        message:
          "Exam does not have a valid exam family",
      });
    }

    const mergedData = {
      ...existingExam.toObject(),
      ...updateData,
    };

    const validationError =
      validateEditableData(mergedData);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const exam =
      await TaxonomyNode.findOneAndUpdate(
        {
          _id: req.params.examId,
          tenantId,
          kind: "exam",
        },
        {
          ...updateData,
          updatedBy: req.user._id,
        },
        {
          new: true,
          runValidators: true,
        }
      );

    return res.status(200).json({
      success: true,
      data: serializeNode(exam),
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "updateExam"
    );
  }
};

// --------------------------------------------------
// Set exam active status
// --------------------------------------------------

const setExamStatus = async (req, res) => {
  try {
    const idError =
      validateObjectId(
        req.params.examId,
        "exam ID"
      );

    if (idError) {
      return res.status(400).json({
        success: false,
        message: idError,
      });
    }

    if (typeof req.body?.isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message:
          "isActive must be provided as a boolean",
      });
    }

    const tenantId =
      requireTenantId(req, res);

    if (!tenantId) {
      return;
    }

    const exam =
      await TaxonomyNode.findOne({
        _id: req.params.examId,
        tenantId,
        kind: "exam",
      });

    if (!exam) {
      return res.status(404).json({
        success: false,
        message:
          "Exam not found or access denied",
      });
    }

    const targetStatus =
      req.body.isActive;

    if (targetStatus === true) {
      const examFamily =
        await TaxonomyNode.findOne({
          _id: exam.parentId,
          tenantId,
          kind: "exam_family",
          isActive: true,
        });

      if (!examFamily) {
        return res.status(400).json({
          success: false,
          message:
            "Activate the parent exam family before activating this exam",
        });
      }
    }

    if (
      targetStatus === false &&
      exam.isActive !== false
    ) {
      const referencedMockTest =
        await MockTest.exists({
          tenantId,
          isActive: true,
          examTaxonomyNodeId: exam._id,
        });

      if (referencedMockTest) {
        return res.status(400).json({
          success: false,
          message:
            "This exam cannot be deactivated while active mock tests reference it",
        });
      }
    }

    exam.isActive =
      targetStatus;

    exam.updatedBy =
      req.user._id;

    await exam.save();

    return res.status(200).json({
      success: true,
      message: targetStatus
        ? "Exam activated successfully"
        : "Exam deactivated successfully",
      data: serializeNode(exam),
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "setExamStatus"
    );
  }
};

module.exports = {
  getExamTaxonomyTree,
  createExamFamily,
  updateExamFamily,
  setExamFamilyStatus,
  createExam,
  updateExam,
  setExamStatus,
};
