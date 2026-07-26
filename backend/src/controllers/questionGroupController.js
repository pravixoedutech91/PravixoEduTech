const {
  getInternalErrorMessage,
  logRuntimeError,
} = require("../utils/runtimeSecurity");
const mongoose = require("mongoose");

const QuestionGroup = require("../models/QuestionGroup");
const { getTenantFilter } = require("../middleware/tenantMiddleware");

//---------------//
// Basic Helpers
//---------------//

const hasText = (value) => {
  return typeof value === "string" && value.trim().length > 0;
};

const getRequestTenantId = (req) => {
  if (req.user.role === "super_admin") {
    return req.body.tenantId || req.query.tenantId || req.user.tenantId;
  }

  return req.user.tenantId;
};

const hasTableData = (tableData) => {
  if (tableData === null || tableData === undefined) {
    return false;
  }

  if (Array.isArray(tableData)) {
    return tableData.length > 0;
  }

  if (typeof tableData === "object") {
    return Object.keys(tableData).length > 0;
  }

  return false;
};

//---------------//
// Allowed Values
//---------------//

const allowedGroupTypes = [
  "passage",
  "cloze",
  "reasoning_set",
  "di_set",
  "match_column",
  "instruction_set",
  "statement_set",
  "caselet",
  "science_diagram",
  "math_set",
  "other",
];

const allowedBlockTypes = [
  "text",
  "instruction",
  "passage",
  "image",
  "table",
  "math",
];

const allowedDisplayModes = [
  "auto",
  "sticky",
  "split",
  "full_width",
  "collapsible",
];

const allowedSourceTypes = ["original", "pyq", "imported"];

const allowedDifficulties = ["easy", "medium", "hard"];

//---------------//
// Content Block Validation
//---------------//

const isMeaningfulContentBlock = (block) => {
  if (!block || block.isVisible === false) {
    return false;
  }

  if (["text", "instruction", "passage"].includes(block.blockType)) {
    return hasText(block.textEn) || hasText(block.textHi);
  }

  if (block.blockType === "image") {
    return hasText(block.imageUrl);
  }

  if (block.blockType === "table") {
    return hasTableData(block.tableData);
  }

  if (block.blockType === "math") {
    return hasText(block.latex);
  }

  return false;
};

const validateContentBlocks = (contentBlocks) => {
  if (contentBlocks === undefined) {
    return null;
  }

  if (!Array.isArray(contentBlocks)) {
    return "contentBlocks must be an array";
  }

  for (let index = 0; index < contentBlocks.length; index += 1) {
    const block = contentBlocks[index];

    if (!block || typeof block !== "object") {
      return `Content block ${index + 1} must be an object`;
    }

    if (!allowedBlockTypes.includes(block.blockType)) {
      return `Content block ${index + 1} has invalid blockType`;
    }

    if (block.order !== undefined && Number(block.order) < 1) {
      return `Content block ${index + 1} order must be at least 1`;
    }

    if (block.isVisible === false) {
      continue;
    }

    if (
      ["text", "instruction", "passage"].includes(block.blockType) &&
      !hasText(block.textEn) &&
      !hasText(block.textHi)
    ) {
      return `Content block ${index + 1} must have English or Hindi text`;
    }

    if (block.blockType === "image" && !hasText(block.imageUrl)) {
      return `Content block ${index + 1} imageUrl is required`;
    }

    if (block.blockType === "table" && !hasTableData(block.tableData)) {
      return `Content block ${index + 1} tableData is required`;
    }

    if (block.blockType === "math" && !hasText(block.latex)) {
      return `Content block ${index + 1} latex is required`;
    }
  }

  return null;
};

//---------------//
// Question Group Validation
//---------------//

const validateQuestionGroupData = (questionGroupData) => {
  if (!hasText(questionGroupData.title)) {
    return "Question group title is required";
  }

  if (!hasText(questionGroupData.slug)) {
    return "Question group slug is required";
  }

  if (!allowedGroupTypes.includes(questionGroupData.groupType)) {
    return "Invalid question group type";
  }

  if (
    questionGroupData.displayMode !== undefined &&
    !allowedDisplayModes.includes(questionGroupData.displayMode)
  ) {
    return "Invalid display mode";
  }

  if (
    questionGroupData.sourceType !== undefined &&
    !allowedSourceTypes.includes(questionGroupData.sourceType)
  ) {
    return "Invalid source type";
  }

  if (
    questionGroupData.difficulty !== undefined &&
    !allowedDifficulties.includes(questionGroupData.difficulty)
  ) {
    return "Invalid difficulty";
  }

  if (
    questionGroupData.expectedQuestionCount !== undefined &&
    Number(questionGroupData.expectedQuestionCount) < 0
  ) {
    return "Expected question count cannot be negative";
  }

  if (
    questionGroupData.pyqDetails &&
    questionGroupData.pyqDetails.year !== undefined &&
    questionGroupData.pyqDetails.year !== null &&
    Number(questionGroupData.pyqDetails.year) < 1900
  ) {
    return "Invalid PYQ year";
  }

  if (
    questionGroupData.tags !== undefined &&
    !Array.isArray(questionGroupData.tags)
  ) {
    return "Tags must be an array";
  }

  const blockError = validateContentBlocks(questionGroupData.contentBlocks);

  if (blockError) {
    return blockError;
  }

  const hasBasicText =
    hasText(questionGroupData.instructionEn) ||
    hasText(questionGroupData.instructionHi) ||
    hasText(questionGroupData.passageEn) ||
    hasText(questionGroupData.passageHi);

  const hasBlocks =
    Array.isArray(questionGroupData.contentBlocks) &&
    questionGroupData.contentBlocks.some((block) =>
      isMeaningfulContentBlock(block)
    );

  if (!hasBasicText && !hasBlocks) {
    return "Question group must have instruction, passage, image, table, math, or content block";
  }

  return null;
};

//---------------//
// Create Question Group
//---------------//

const createQuestionGroup = async (req, res) => {
  try {
    const tenantId = getRequestTenantId(req);

    const questionGroupData = {
      ...req.body,
      tenantId,
      createdBy: req.user._id,
    };

    delete questionGroupData._id;
    delete questionGroupData.__v;
    delete questionGroupData.updatedBy;
    delete questionGroupData.createdAt;
    delete questionGroupData.updatedAt;

    const validationError = validateQuestionGroupData(questionGroupData);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const questionGroup = await QuestionGroup.create(questionGroupData);

    res.status(201).json({
      success: true,
      data: questionGroup,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Question group slug already exists for this tenant",
      });
    }

    logRuntimeError("questionGroupController error:", error);

    res.status(500).json({
      success: false,
      message: getInternalErrorMessage(error),
    });
  }
};

//---------------//
// Get All Question Groups
//---------------//

const getAllQuestionGroups = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);

    const filter = {
      ...tenantFilter,
    };

    const includeInactive = req.query.includeInactive === "true";

    if (!includeInactive) {
      filter.isActive = true;
    }

    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === "true";
    }

    if (req.query.groupType) {
      filter.groupType = req.query.groupType;
    }

    if (req.query.subject) {
      filter.subject = req.query.subject;
    }

    if (req.query.topic) {
      filter.topic = req.query.topic;
    }

    if (req.query.sourceType) {
      filter.sourceType = req.query.sourceType;
    }

    if (req.query.difficulty) {
      filter.difficulty = req.query.difficulty;
    }

    const questionGroups = await QuestionGroup.find(filter).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      count: questionGroups.length,
      data: questionGroups,
    });
  } catch (error) {
    logRuntimeError("questionGroupController error:", error);

    res.status(500).json({
      success: false,
      message: getInternalErrorMessage(error),
    });
  }
};
//---------------//
// Get Single Question Group
//---------------//

const getSingleQuestionGroup = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid question group ID",
      });
    }

    const tenantFilter = getTenantFilter(req);

    const questionGroup = await QuestionGroup.findOne({
      _id: req.params.id,
      ...tenantFilter,
    });

    if (!questionGroup) {
      return res.status(404).json({
        success: false,
        message: "Question group not found or access denied",
      });
    }

    res.status(200).json({
      success: true,
      data: questionGroup,
    });
  } catch (error) {
    logRuntimeError("questionGroupController error:", error);

    res.status(500).json({
      success: false,
      message: getInternalErrorMessage(error),
    });
  }
};

//---------------//
// Update Question Group
//---------------//

const updateQuestionGroup = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid question group ID",
      });
    }

    const tenantFilter = getTenantFilter(req);

    const existingQuestionGroup = await QuestionGroup.findOne({
      _id: req.params.id,
      ...tenantFilter,
    });

    if (!existingQuestionGroup) {
      return res.status(404).json({
        success: false,
        message: "Question group not found or access denied",
      });
    }

    const updateData = {
      ...req.body,
      updatedBy: req.user._id,
    };

    delete updateData._id;
    delete updateData.__v;
    delete updateData.tenantId;
    delete updateData.createdBy;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    delete updateData.isActive;

    if (updateData.pyqDetails) {
      updateData.pyqDetails = {
        ...(existingQuestionGroup.pyqDetails?.toObject
          ? existingQuestionGroup.pyqDetails.toObject()
          : existingQuestionGroup.pyqDetails || {}),
        ...updateData.pyqDetails,
      };
    }

    const mergedQuestionGroupData = {
      ...existingQuestionGroup.toObject(),
      ...updateData,
    };

    const validationError = validateQuestionGroupData(mergedQuestionGroupData);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const questionGroup = await QuestionGroup.findOneAndUpdate(
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

    res.status(200).json({
      success: true,
      data: questionGroup,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Question group slug already exists for this tenant",
      });
    }

    logRuntimeError("questionGroupController error:", error);

    res.status(500).json({
      success: false,
      message: getInternalErrorMessage(error),
    });
  }
};

//---------------//
// Disable Question Group
//---------------//

const disableQuestionGroup = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid question group ID",
      });
    }

    const tenantFilter = getTenantFilter(req);

    const questionGroup = await QuestionGroup.findOneAndUpdate(
      {
        _id: req.params.id,
        ...tenantFilter,
      },
      {
        isActive: false,
        updatedBy: req.user._id,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!questionGroup) {
      return res.status(404).json({
        success: false,
        message: "Question group not found or access denied",
      });
    }

    res.status(200).json({
      success: true,
      message: "Question group disabled successfully",
      data: questionGroup,
    });
  } catch (error) {
    logRuntimeError("questionGroupController error:", error);

    res.status(500).json({
      success: false,
      message: getInternalErrorMessage(error),
    });
  }
};

module.exports = {
  createQuestionGroup,
  getAllQuestionGroups,
  getSingleQuestionGroup,
  updateQuestionGroup,
  disableQuestionGroup,
};