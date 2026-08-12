const {
  getInternalErrorMessage,
  logRuntimeError,
} = require("../utils/runtimeSecurity");
const mongoose = require("mongoose");
const Question = require("../models/Question");
const QuestionGroup = require("../models/QuestionGroup");
const Category = require("../models/Category");
const { getTenantFilter } = require("../middleware/tenantMiddleware");

const hasText = (value) => {
  return typeof value === "string" && value.trim().length > 0;
};

const getRequestTenantId = (req) => {
  if (req.user.role === "super_admin") {
    return req.body.tenantId || req.query.tenantId || req.user.tenantId;
  }

  return req.user.tenantId;
};

const validateQuestionContent = (questionData) => {
  if (
    !hasText(questionData.questionTextEn) &&
    !hasText(questionData.questionTextHi) &&
    !hasText(questionData.questionImageUrl)
  ) {
    return "Question text or image is required";
  }

  if (questionData.marks !== undefined && Number(questionData.marks) < 0) {
    return "Marks cannot be negative";
  }

  if (
    questionData.negativeMarks !== undefined &&
    Number(questionData.negativeMarks) < 0
  ) {
    return "Negative marks cannot be negative";
  }

  return null;
};

const validateMcqQuestion = (questionData) => {
  if (questionData.questionType !== "mcq") {
    return "Only MCQ questions are supported in v1";
  }

  if (!Array.isArray(questionData.options)) {
    return "Options are required for MCQ questions";
  }

  if (questionData.options.length < 2 || questionData.options.length > 5) {
    return "MCQ questions must have between 2 and 5 options";
  }

  const optionIds = questionData.options.map((option) => option.optionId);

  const uniqueOptionIds = new Set(optionIds);

  if (uniqueOptionIds.size !== optionIds.length) {
    return "Option IDs must be unique";
  }

  for (const option of questionData.options) {
    if (!option.optionId) {
      return "Each option must have an optionId";
    }

    if (
      !hasText(option.textEn) &&
      !hasText(option.textHi) &&
      !hasText(option.imageUrl)
    ) {
      return `Option ${option.optionId} must have text or image`;
    }
  }

  if (!questionData.correctOptionId) {
    return "Correct option is required for MCQ questions";
  }

  if (!optionIds.includes(questionData.correctOptionId)) {
    return "Correct option must match one of the option IDs";
  }

  return null;
};

const validateCategoryAccess = async (categoryId, tenantId) => {
  if (!categoryId) {
    return {
      success: true,
    };
  }

  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
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
      message: "Category not found or access denied",
    };
  }

  return {
    success: true,
  };
};

const sanitizeQuestionGroupFields = (questionData) => {
  if (questionData.questionGroupId === "") {
    questionData.questionGroupId = null;
  }

  if (questionData.groupQuestionOrder === "") {
    questionData.groupQuestionOrder = null;
  }

  if (questionData.questionGroupId === null) {
    questionData.groupQuestionOrder = null;
  }
};

const validateQuestionGroupAccess = async (questionData, tenantId) => {
  const questionGroupId = questionData.questionGroupId;

  if (!questionGroupId) {
    if (
      questionData.groupQuestionOrder !== undefined &&
      questionData.groupQuestionOrder !== null
    ) {
      return {
        success: false,
        message: "questionGroupId is required when groupQuestionOrder is provided",
      };
    }

    return {
      success: true,
    };
  }

  if (!mongoose.Types.ObjectId.isValid(questionGroupId)) {
    return {
      success: false,
      message: "Invalid question group ID",
    };
  }

  const groupQuestionOrder = Number(questionData.groupQuestionOrder);

  if (!Number.isInteger(groupQuestionOrder) || groupQuestionOrder < 1) {
    return {
      success: false,
      message: "groupQuestionOrder must be a positive integer",
    };
  }

  questionData.groupQuestionOrder = groupQuestionOrder;

  const questionGroup = await QuestionGroup.findOne({
    _id: questionGroupId,
    tenantId,
    isActive: true,
  });

  if (!questionGroup) {
    return {
      success: false,
      message: "Question group not found, inactive, or access denied",
    };
  }

  return {
    success: true,
  };
};

const BULK_IMPORT_QUESTION_FIELDS = [
  "externalQuestionKey",
  "categoryExternalKey",
  "questionGroupExternalKey",
  "groupQuestionOrder",
  "questionType",
  "sourceType",
  "subject",
  "topic",
  "subTopic",
  "questionTextEn",
  "questionTextHi",
  "questionImageUrl",
  "optionAEn",
  "optionBEn",
  "optionCEn",
  "optionDEn",
  "optionAHi",
  "optionBHi",
  "optionCHi",
  "optionDHi",
  "optionAImageUrl",
  "optionBImageUrl",
  "optionCImageUrl",
  "optionDImageUrl",
  "correctOptionId",
  "explanationEn",
  "explanationHi",
  "explanationImageUrl",
  "marks",
  "negativeMarks",
  "difficulty",
  "tagsCsv",
  "pyqExamName",
  "pyqYear",
  "pyqShift",
  "pyqPaperCode",
  "isActive",
  "sourceQuestionId",
  "sourcePage",
  "sourceTopicCode",
  "contentStatus",
  "answerVerifiedBy",
  "languageVerifiedBy",
];

const BULK_IMPORT_QUESTION_FIELD_SET = new Set(
  BULK_IMPORT_QUESTION_FIELDS
);

const normalizeBulkImportString = (value) => {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
};

const addBulkImportIssue = (
  issues,
  field,
  message
) => {
  issues.push({
    field,
    message,
  });
};

const parseBulkImportNumber = (
  value,
  field,
  issues,
  {
    required = false,
    integer = false,
    min = null,
  } = {}
) => {
  const normalizedValue =
    normalizeBulkImportString(value);

  if (!normalizedValue) {
    if (required) {
      addBulkImportIssue(
        issues,
        field,
        `${field} is required`
      );
    }

    return undefined;
  }

  const parsedValue = Number(normalizedValue);

  if (!Number.isFinite(parsedValue)) {
    addBulkImportIssue(
      issues,
      field,
      `${field} must be a valid number`
    );

    return undefined;
  }

  if (integer && !Number.isInteger(parsedValue)) {
    addBulkImportIssue(
      issues,
      field,
      `${field} must be an integer`
    );

    return undefined;
  }

  if (min !== null && parsedValue < min) {
    addBulkImportIssue(
      issues,
      field,
      `${field} must be at least ${min}`
    );

    return undefined;
  }

  return parsedValue;
};

const parseBulkImportBoolean = (
  value,
  field,
  issues,
  { required = false } = {}
) => {
  if (typeof value === "boolean") {
    return value;
  }

  const normalizedValue =
    normalizeBulkImportString(value).toLowerCase();

  if (!normalizedValue) {
    if (required) {
      addBulkImportIssue(
        issues,
        field,
        `${field} is required`
      );
    }

    return undefined;
  }

  if (normalizedValue === "true") {
    return true;
  }

  if (normalizedValue === "false") {
    return false;
  }

  addBulkImportIssue(
    issues,
    field,
    `${field} must be true or false`
  );

  return undefined;
};

const parseBulkImportTags = (value) => {
  const normalizedValue =
    normalizeBulkImportString(value);

  if (!normalizedValue) {
    return [];
  }

  const seen = new Set();
  const tags = [];

  normalizedValue
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .forEach((tag) => {
      const normalizedTag = tag.toLowerCase();

      if (seen.has(normalizedTag)) {
        return;
      }

      seen.add(normalizedTag);
      tags.push(tag);
    });

  return tags;
};

const transformBulkImportQuestionRow = (
  rowData,
  tenantId,
  category
) => {
  const issues = [];
  const warnings = [];

  BULK_IMPORT_QUESTION_FIELDS.forEach((field) => {
    if (
      !Object.prototype.hasOwnProperty.call(
        rowData,
        field
      )
    ) {
      addBulkImportIssue(
        issues,
        field,
        `Bulk import field ${field} is missing`
      );
    }
  });

  Object.keys(rowData).forEach((field) => {
    if (!BULK_IMPORT_QUESTION_FIELD_SET.has(field)) {
      addBulkImportIssue(
        issues,
        field,
        `Unsupported bulk import field: ${field}`
      );
    }
  });

  const externalQuestionKey =
    normalizeBulkImportString(
      rowData.externalQuestionKey
    ).toUpperCase();

  const questionGroupExternalKey =
    normalizeBulkImportString(
      rowData.questionGroupExternalKey
    );

  const groupQuestionOrder =
    parseBulkImportNumber(
      rowData.groupQuestionOrder,
      "groupQuestionOrder",
      issues,
      {
        integer: true,
        min: 1,
      }
    );

  if (questionGroupExternalKey) {
    addBulkImportIssue(
      issues,
      "questionGroupExternalKey",
      "Question-group external-key resolution is not enabled in B1E-B2 yet"
    );
  }

  if (
    groupQuestionOrder !== undefined &&
    !questionGroupExternalKey
  ) {
    addBulkImportIssue(
      issues,
      "groupQuestionOrder",
      "questionGroupExternalKey is required when groupQuestionOrder is provided"
    );
  }

  const questionType =
    normalizeBulkImportString(
      rowData.questionType
    ).toLowerCase();

  const sourceType =
    normalizeBulkImportString(
      rowData.sourceType
    ).toLowerCase();

  const difficulty =
    normalizeBulkImportString(
      rowData.difficulty
    ).toLowerCase();

  const correctOptionId =
    normalizeBulkImportString(
      rowData.correctOptionId
    ).toUpperCase();

  const marks =
    parseBulkImportNumber(
      rowData.marks,
      "marks",
      issues,
      {
        required: true,
        min: 0,
      }
    );

  const negativeMarks =
    parseBulkImportNumber(
      rowData.negativeMarks,
      "negativeMarks",
      issues,
      {
        required: true,
        min: 0,
      }
    );

  const isActive =
    parseBulkImportBoolean(
      rowData.isActive,
      "isActive",
      issues,
      {
        required: true,
      }
    );

  const pyqYear =
    parseBulkImportNumber(
      rowData.pyqYear,
      "pyqYear",
      issues,
      {
        integer: true,
        min: 1,
      }
    );

  const sourcePage =
    parseBulkImportNumber(
      rowData.sourcePage,
      "sourcePage",
      issues,
      {
        integer: true,
        min: 1,
      }
    );

  const optionIds = ["A", "B", "C", "D"];

  const options = optionIds.map((optionId) => ({
    optionId,
    textEn:
      normalizeBulkImportString(
        rowData[`option${optionId}En`]
      ),
    textHi:
      normalizeBulkImportString(
        rowData[`option${optionId}Hi`]
      ),
    imageUrl:
      normalizeBulkImportString(
        rowData[`option${optionId}ImageUrl`]
      ),
  }));

  const pyqExamName =
    normalizeBulkImportString(
      rowData.pyqExamName
    );

  const pyqShift =
    normalizeBulkImportString(
      rowData.pyqShift
    );

  const pyqPaperCode =
    normalizeBulkImportString(
      rowData.pyqPaperCode
    );

  const contentStatus =
    normalizeBulkImportString(
      rowData.contentStatus
    );

  const questionData = {
    tenantId,
    externalQuestionKey,
    categoryId: category
      ? category._id
      : undefined,

    questionGroupId: null,
    groupQuestionOrder: null,

    subject:
      normalizeBulkImportString(
        rowData.subject
      ),

    topic:
      normalizeBulkImportString(
        rowData.topic
      ),

    subTopic:
      normalizeBulkImportString(
        rowData.subTopic
      ),

    questionType,
    sourceType,

    questionTextEn:
      normalizeBulkImportString(
        rowData.questionTextEn
      ),

    questionTextHi:
      normalizeBulkImportString(
        rowData.questionTextHi
      ),

    questionImageUrl:
      normalizeBulkImportString(
        rowData.questionImageUrl
      ),

    options,
    correctOptionId,

    explanationEn:
      normalizeBulkImportString(
        rowData.explanationEn
      ),

    explanationHi:
      normalizeBulkImportString(
        rowData.explanationHi
      ),

    explanationImageUrl:
      normalizeBulkImportString(
        rowData.explanationImageUrl
      ),

    marks,
    negativeMarks,
    difficulty,

    tags:
      parseBulkImportTags(
        rowData.tagsCsv
      ),

    pyqDetails: {
      examName: pyqExamName,
      ...(pyqYear !== undefined
        ? { year: pyqYear }
        : {}),
      shift: pyqShift,
      paperCode: pyqPaperCode,
    },

    importMetadata: {
      sourceQuestionId:
        normalizeBulkImportString(
          rowData.sourceQuestionId
        ),

      ...(sourcePage !== undefined
        ? { sourcePage }
        : {}),

      sourceTopicCode:
        normalizeBulkImportString(
          rowData.sourceTopicCode
        ),

      contentStatus,

      answerVerifiedBy:
        normalizeBulkImportString(
          rowData.answerVerifiedBy
        ),

      languageVerifiedBy:
        normalizeBulkImportString(
          rowData.languageVerifiedBy
        ),
    },

    isActive,
  };

  if (!externalQuestionKey) {
    addBulkImportIssue(
      issues,
      "externalQuestionKey",
      "External question key is required"
    );
  }

  if (!hasText(questionData.questionTextEn)) {
    addBulkImportIssue(
      issues,
      "questionTextEn",
      "English question text is required for bulk import"
    );
  }

  if (!hasText(questionData.questionTextHi)) {
    addBulkImportIssue(
      issues,
      "questionTextHi",
      "Hindi question text is required for bulk import"
    );
  }

  options.forEach((option) => {
    if (!hasText(option.textEn)) {
      addBulkImportIssue(
        issues,
        `option${option.optionId}En`,
        `English text is required for option ${option.optionId}`
      );
    }

    if (!hasText(option.textHi)) {
      addBulkImportIssue(
        issues,
        `option${option.optionId}Hi`,
        `Hindi text is required for option ${option.optionId}`
      );
    }
  });

  if (!hasText(questionData.explanationEn)) {
    addBulkImportIssue(
      issues,
      "explanationEn",
      "English explanation is required for bulk import"
    );
  }

  if (!hasText(questionData.explanationHi)) {
    addBulkImportIssue(
      issues,
      "explanationHi",
      "Hindi explanation is required for bulk import"
    );
  }

  if (!contentStatus) {
    addBulkImportIssue(
      issues,
      "contentStatus",
      "contentStatus is required for bulk import"
    );
  } else if (
    contentStatus.toLowerCase() === "approved"
  ) {
    addBulkImportIssue(
      issues,
      "contentStatus",
      "Bulk import cannot grant final editorial approval"
    );
  } else {
    warnings.push({
      field: "contentStatus",
      message:
        `Content status is ${contentStatus}; editorial QA remains required before publication`,
    });
  }

  const hasPyqProvenance =
    hasText(pyqExamName) ||
    pyqYear !== undefined ||
    hasText(pyqShift) ||
    hasText(pyqPaperCode);

  if (sourceType === "pyq") {
    if (!hasText(pyqExamName)) {
      addBulkImportIssue(
        issues,
        "pyqExamName",
        "PYQ exam name is required when sourceType is pyq"
      );
    }

    if (pyqYear === undefined) {
      addBulkImportIssue(
        issues,
        "pyqYear",
        "PYQ year is required when sourceType is pyq"
      );
    }

    if (!hasText(pyqShift)) {
      addBulkImportIssue(
        issues,
        "pyqShift",
        "PYQ shift is required when sourceType is pyq"
      );
    }
  } else if (
    sourceType === "original" &&
    hasPyqProvenance
  ) {
    addBulkImportIssue(
      issues,
      "pyqDetails",
      "Original questions must not contain PYQ provenance"
    );
  }

  const contentError =
    validateQuestionContent(questionData);

  if (contentError) {
    addBulkImportIssue(
      issues,
      "question",
      contentError
    );
  }

  const mcqError =
    validateMcqQuestion(questionData);

  if (mcqError) {
    addBulkImportIssue(
      issues,
      "question",
      mcqError
    );
  }

  const schemaProbe = new Question(questionData);
  const schemaError = schemaProbe.validateSync();

  if (schemaError) {
    Object.values(schemaError.errors).forEach(
      (error) => {
        addBulkImportIssue(
          issues,
          error.path || "schema",
          error.message
        );
      }
    );
  }

  return {
    questionData,
    issues,
    warnings,
  };
};

// Create Question
const createQuestion = async (req, res) => {
  try {
    const tenantId = getRequestTenantId(req);

    const questionData = {
      ...req.body,
      tenantId,
      createdBy: req.user._id,
    };

    delete questionData.externalQuestionKey;

    sanitizeQuestionGroupFields(questionData);

    const contentError = validateQuestionContent(questionData);

    if (contentError) {
      return res.status(400).json({
        success: false,
        message: contentError,
      });
    }

    const mcqError = validateMcqQuestion(questionData);

    if (mcqError) {
      return res.status(400).json({
        success: false,
        message: mcqError,
      });
    }

    const categoryValidation = await validateCategoryAccess(
      questionData.categoryId,
      tenantId
    );

    if (!categoryValidation.success) {
      return res.status(400).json({
        success: false,
        message: categoryValidation.message,
      });
    }

    const questionGroupValidation = await validateQuestionGroupAccess(
      questionData,
      tenantId
    );

    if (!questionGroupValidation.success) {
      return res.status(400).json({
        success: false,
        message: questionGroupValidation.message,
      });
    }

    const question = await Question.create(questionData);

    await question.populate("categoryId", "name slug");
    await question.populate(
      "questionGroupId",
      "title slug groupType displayMode isActive"
    );

    res.status(201).json({
      success: true,
      data: question,
    });
  } catch (error) {
    logRuntimeError("questionController error:", error);

    res.status(500).json({
      success: false,
      message: getInternalErrorMessage(error),
    });
  }
};

const dryRunQuestionBulkImport = async (req, res) => {
  try {
    const tenantId = getRequestTenantId(req);

    if (!hasText(String(tenantId || ""))) {
      return res.status(400).json({
        success: false,
        message: "Tenant is required for bulk import dry run",
      });
    }

    const rows = req.body?.rows;

    const validationMode =
      req.body?.validationMode === "full"
        ? "full"
        : "resolver";

    const fullValidation =
      validationMode === "full";

    if (!Array.isArray(rows)) {
      return res.status(400).json({
        success: false,
        message: "rows must be an array",
      });
    }

    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one row is required",
      });
    }

    if (rows.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Bulk import dry run supports at most 100 rows per request",
      });
    }

    const normalizedRows = rows.map((row, index) => {
      const rowData =
        row &&
        typeof row === "object" &&
        !Array.isArray(row)
          ? row
          : {};

      const externalQuestionKey =
        typeof rowData.externalQuestionKey === "string"
          ? rowData.externalQuestionKey.trim()
          : "";

      const categoryExternalKey =
        typeof rowData.categoryExternalKey === "string"
          ? rowData.categoryExternalKey.trim().toLowerCase()
          : "";

      const issues = [];

      if (
        !row ||
        typeof row !== "object" ||
        Array.isArray(row)
      ) {
        issues.push({
          field: "row",
          message: "Each dry-run row must be an object",
        });
      }

      if (!externalQuestionKey) {
        issues.push({
          field: "externalQuestionKey",
          message: "External question key is required",
        });
      }

      if (!categoryExternalKey) {
        issues.push({
          field: "categoryExternalKey",
          message: "Category external key is required",
        });
      }

      return {
        rowNumber: index + 1,
        externalQuestionKey,
        categoryExternalKey,
        rowData:
          fullValidation
            ? rowData
            : null,
        issues,
      };
    });

    const externalKeyRows = new Map();

    normalizedRows.forEach((row, index) => {
      if (!row.externalQuestionKey) {
        return;
      }

      const normalizedExternalKey =
        row.externalQuestionKey.toLowerCase();

      const indexes =
        externalKeyRows.get(normalizedExternalKey) || [];

      indexes.push(index);

      externalKeyRows.set(
        normalizedExternalKey,
        indexes
      );
    });

    externalKeyRows.forEach((indexes) => {
      if (indexes.length < 2) {
        return;
      }

      indexes.forEach((index) => {
        normalizedRows[index].issues.push({
          field: "externalQuestionKey",
          message:
            "External question key is duplicated in this dry-run request",
        });
      });
    });

    const categoryExternalKeys = [
      ...new Set(
        normalizedRows
          .map((row) => row.categoryExternalKey)
          .filter(Boolean)
      ),
    ];

    const categories =
      categoryExternalKeys.length > 0
        ? await Category.find({
            tenantId,
            slug: {
              $in: categoryExternalKeys,
            },
          })
            .select("_id name slug isActive")
            .lean()
        : [];

    const categoryBySlug = new Map(
      categories.map((category) => [
        category.slug,
        category,
      ])
    );

    const externalQuestionKeys =
      fullValidation
        ? [
            ...new Set(
              normalizedRows
                .map((row) =>
                  row.externalQuestionKey
                    ? row.externalQuestionKey
                        .trim()
                        .toUpperCase()
                    : ""
                )
                .filter(Boolean)
            ),
          ]
        : [];

    const existingQuestions =
      fullValidation &&
      externalQuestionKeys.length > 0
        ? await Question.find({
            tenantId,
            externalQuestionKey: {
              $in: externalQuestionKeys,
            },
          })
            .select("_id externalQuestionKey")
            .lean()
        : [];

    const existingQuestionByExternalKey =
      new Map(
        existingQuestions.map((question) => [
          question.externalQuestionKey,
          question,
        ])
      );

    const data = normalizedRows.map((row) => {
      const issues = [...row.issues];
      const warnings = [];

      const category = row.categoryExternalKey
        ? categoryBySlug.get(
            row.categoryExternalKey
          ) || null
        : null;

      if (
        row.categoryExternalKey &&
        !category
      ) {
        issues.push({
          field: "categoryExternalKey",
          message:
            "Category external key could not be resolved for the authorized tenant",
        });
      }

      let questionPreview = null;

      if (fullValidation) {
        if (
          category &&
          category.isActive !== true
        ) {
          issues.push({
            field: "categoryExternalKey",
            message:
              "Resolved category is inactive and cannot be used for bulk import",
          });
        }

        const normalizedExternalQuestionKey =
          row.externalQuestionKey
            ? row.externalQuestionKey
                .trim()
                .toUpperCase()
            : "";

        const existingQuestion =
          normalizedExternalQuestionKey
            ? existingQuestionByExternalKey.get(
                normalizedExternalQuestionKey
              ) || null
            : null;

        if (existingQuestion) {
          issues.push({
            field: "externalQuestionKey",
            message:
              "External question key already exists for the authorized tenant",
          });
        }

        const transformed =
          transformBulkImportQuestionRow(
            row.rowData || {},
            tenantId,
            category
          );

        issues.push(...transformed.issues);
        warnings.push(...transformed.warnings);

        questionPreview =
          transformed.questionData;
      }

      return {
        rowNumber: row.rowNumber,
        externalQuestionKey:
          row.externalQuestionKey,
        categoryExternalKey:
          row.categoryExternalKey,
        status:
          issues.length > 0
            ? "blocked"
            : "resolved",
        category: category
          ? {
              _id: String(category._id),
              name: category.name,
              slug: category.slug,
              isActive: category.isActive,
            }
          : null,
        issues,
        warnings,
        questionPreview,
      };
    });

    const resolvedRows = data.filter(
      (row) => row.status === "resolved"
    ).length;

    const blockedRows =
      data.length - resolvedRows;

    res.status(200).json({
      success: true,
      dryRun: true,
      writesPerformed: 0,
      targetTenantId: tenantId,
      validationMode,
      summary: {
        rowsReceived: data.length,
        resolvedRows,
        blockedRows,
        warningRows:
          data.filter(
            (row) => row.warnings.length > 0
          ).length,
        existingQuestionKeys:
          existingQuestions.length,
        uniqueCategoryKeys:
          categoryExternalKeys.length,
        resolvedCategoryKeys:
          categories.length,
        unresolvedCategoryKeys:
          categoryExternalKeys.length -
          categories.length,
      },
      data,
    });
  } catch (error) {
    logRuntimeError(
      "questionController bulk import dry-run error:",
      error
    );

    res.status(500).json({
      success: false,
      message: getInternalErrorMessage(error),
    });
  }
};

const executeQuestionBulkImport = async (req, res) => {
  let session = null;

  try {
    const tenantId = getRequestTenantId(req);

    if (!hasText(String(tenantId || ""))) {
      return res.status(400).json({
        success: false,
        executed: false,
        writesPerformed: 0,
        message: "Tenant is required for bulk import execute",
      });
    }

    const rows = req.body?.rows;

    if (!Array.isArray(rows)) {
      return res.status(400).json({
        success: false,
        executed: false,
        writesPerformed: 0,
        message: "rows must be an array",
      });
    }

    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        executed: false,
        writesPerformed: 0,
        message: "At least one row is required",
      });
    }

    if (rows.length > 100) {
      return res.status(400).json({
        success: false,
        executed: false,
        writesPerformed: 0,
        message:
          "Controlled bulk import execute supports at most 100 rows per request",
      });
    }

    const normalizedRows = rows.map((row, index) => {
      const rowIsObject =
        row &&
        typeof row === "object" &&
        !Array.isArray(row);

      const rowData = rowIsObject
        ? row
        : {};

      const issues = [];

      if (!rowIsObject) {
        addBulkImportIssue(
          issues,
          "row",
          "Each bulk-import row must be an object"
        );
      }

      const externalQuestionKey =
        normalizeBulkImportString(
          rowData.externalQuestionKey
        ).toUpperCase();

      const categoryExternalKey =
        normalizeBulkImportString(
          rowData.categoryExternalKey
        ).toLowerCase();

      if (!externalQuestionKey) {
        addBulkImportIssue(
          issues,
          "externalQuestionKey",
          "External question key is required"
        );
      }

      if (!categoryExternalKey) {
        addBulkImportIssue(
          issues,
          "categoryExternalKey",
          "Category external key is required"
        );
      }

      return {
        rowNumber: index + 1,
        rowData,
        externalQuestionKey,
        categoryExternalKey,
        issues,
      };
    });

    const externalKeyRows = new Map();

    normalizedRows.forEach((row, index) => {
      if (!row.externalQuestionKey) {
        return;
      }

      const indexes =
        externalKeyRows.get(
          row.externalQuestionKey
        ) || [];

      indexes.push(index);

      externalKeyRows.set(
        row.externalQuestionKey,
        indexes
      );
    });

    externalKeyRows.forEach((indexes) => {
      if (indexes.length < 2) {
        return;
      }

      indexes.forEach((index) => {
        addBulkImportIssue(
          normalizedRows[index].issues,
          "externalQuestionKey",
          "External question key is duplicated in this execute request"
        );
      });
    });

    const categoryExternalKeys = [
      ...new Set(
        normalizedRows
          .map((row) => row.categoryExternalKey)
          .filter(Boolean)
      ),
    ];

    const categories =
      categoryExternalKeys.length > 0
        ? await Category.find({
            tenantId,
            slug: {
              $in: categoryExternalKeys,
            },
          })
            .select("_id name slug isActive")
            .lean()
        : [];

    const categoryBySlug = new Map(
      categories.map((category) => [
        String(category.slug)
          .trim()
          .toLowerCase(),
        category,
      ])
    );

    const externalQuestionKeys = [
      ...new Set(
        normalizedRows
          .map((row) => row.externalQuestionKey)
          .filter(Boolean)
      ),
    ];

    const existingQuestions =
      externalQuestionKeys.length > 0
        ? await Question.find({
            tenantId,
            externalQuestionKey: {
              $in: externalQuestionKeys,
            },
          })
            .select("_id externalQuestionKey")
            .lean()
        : [];

    const existingQuestionByExternalKey =
      new Map(
        existingQuestions.map((question) => [
          question.externalQuestionKey,
          question,
        ])
      );

    const data = normalizedRows.map((row) => {
      const issues = [...row.issues];
      const warnings = [];

      const category =
        row.categoryExternalKey
          ? categoryBySlug.get(
              row.categoryExternalKey
            ) || null
          : null;

      if (
        row.categoryExternalKey &&
        !category
      ) {
        addBulkImportIssue(
          issues,
          "categoryExternalKey",
          "Category external key could not be resolved for the authorized tenant"
        );
      }

      if (
        category &&
        category.isActive !== true
      ) {
        addBulkImportIssue(
          issues,
          "categoryExternalKey",
          "Resolved category is inactive and cannot be used for bulk import"
        );
      }

      const existingQuestion =
        row.externalQuestionKey
          ? existingQuestionByExternalKey.get(
              row.externalQuestionKey
            ) || null
          : null;

      if (existingQuestion) {
        addBulkImportIssue(
          issues,
          "externalQuestionKey",
          "External question key already exists for the authorized tenant"
        );
      }

      const transformed =
        transformBulkImportQuestionRow(
          row.rowData,
          tenantId,
          category
        );

      issues.push(...transformed.issues);
      warnings.push(...transformed.warnings);

      return {
        rowNumber: row.rowNumber,
        externalQuestionKey:
          row.externalQuestionKey,
        categoryExternalKey:
          row.categoryExternalKey,
        status:
          issues.length > 0
            ? "blocked"
            : "ready",
        category: category
          ? {
              _id: String(category._id),
              name: category.name,
              slug: category.slug,
              isActive: category.isActive,
            }
          : null,
        issues,
        warnings,
        questionData:
          transformed.questionData,
      };
    });

    const blockedRows =
      data.filter(
        (row) => row.status === "blocked"
      ).length;

    const readyRows =
      data.length - blockedRows;

    const warningRows =
      data.filter(
        (row) => row.warnings.length > 0
      ).length;

    if (blockedRows > 0) {
      const responseStatus =
        existingQuestions.length > 0
          ? 409
          : 400;

      return res.status(responseStatus).json({
        success: false,
        executed: false,
        writesPerformed: 0,
        targetTenantId: tenantId,
        message:
          "Bulk import execute was blocked by server-side preflight validation",
        summary: {
          rowsReceived: data.length,
          readyRows,
          blockedRows,
          warningRows,
          existingQuestionKeys:
            existingQuestions.length,
          uniqueCategoryKeys:
            categoryExternalKeys.length,
          resolvedCategoryKeys:
            categories.length,
          unresolvedCategoryKeys:
            categoryExternalKeys.length -
            categories.length,
        },
        data: data.map((row) => ({
          rowNumber: row.rowNumber,
          externalQuestionKey:
            row.externalQuestionKey,
          categoryExternalKey:
            row.categoryExternalKey,
          status: row.status,
          category: row.category,
          issues: row.issues,
          warnings: row.warnings,
        })),
      });
    }

    session = await mongoose.startSession();

    let createdRows = [];

    await session.withTransaction(async () => {
      const transactionExisting =
        await Question.find({
          tenantId,
          externalQuestionKey: {
            $in: externalQuestionKeys,
          },
        })
          .select("_id externalQuestionKey")
          .session(session)
          .lean();

      if (transactionExisting.length > 0) {
        const conflictError = new Error(
          "One or more external question keys already exist"
        );

        conflictError.code =
          "BULK_IMPORT_CONFLICT";

        conflictError.externalQuestionKeys =
          transactionExisting.map(
            (question) =>
              question.externalQuestionKey
          );

        throw conflictError;
      }

      const pendingCreatedRows = [];

      for (const row of data) {
        const question = new Question({
          ...row.questionData,
          tenantId,
          createdBy: req.user._id,
        });

        await question.save({
          session,
        });

        pendingCreatedRows.push({
          rowNumber: row.rowNumber,
          externalQuestionKey:
            question.externalQuestionKey,
          questionId:
            String(question._id),
        });
      }

      createdRows = pendingCreatedRows;
    });

    return res.status(201).json({
      success: true,
      executed: true,
      writesPerformed:
        createdRows.length,
      targetTenantId: tenantId,
      message:
        "Bulk question import completed successfully",
      summary: {
        rowsReceived: data.length,
        createdRows:
          createdRows.length,
        blockedRows: 0,
        warningRows,
        existingQuestionKeys: 0,
        uniqueCategoryKeys:
          categoryExternalKeys.length,
        resolvedCategoryKeys:
          categories.length,
        unresolvedCategoryKeys:
          categoryExternalKeys.length -
          categories.length,
      },
      data: createdRows,
    });
  } catch (error) {
    if (
      error?.code ===
        "BULK_IMPORT_CONFLICT" ||
      error?.code === 11000
    ) {
      return res.status(409).json({
        success: false,
        executed: false,
        writesPerformed: 0,
        message:
          "Bulk import conflicted with an existing external question key; no import rows were committed",
        existingQuestionKeys:
          Array.isArray(
            error.externalQuestionKeys
          )
            ? error.externalQuestionKeys
            : [],
      });
    }

    logRuntimeError(
      "questionController bulk import execute error:",
      error
    );

    return res.status(500).json({
      success: false,
      executed: false,
      writesPerformed: 0,
      message:
        getInternalErrorMessage(error),
    });
  } finally {
    if (session) {
      try {
        await session.endSession();
      } catch (sessionError) {
        logRuntimeError(
          "questionController bulk import session cleanup error:",
          sessionError
        );
      }
    }
  }
};

// Get All Questions
const getAllQuestions = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);

    const filter = {
      ...tenantFilter,
    };

    if (req.query.categoryId) {
      filter.categoryId = req.query.categoryId;
    }

    if (req.query.questionGroupId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.questionGroupId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid question group ID",
        });
      }

      filter.questionGroupId = req.query.questionGroupId;
    }

    if (req.query.questionType) {
      filter.questionType = req.query.questionType;
    }

    if (req.query.sourceType) {
      filter.sourceType = req.query.sourceType;
    }

    if (req.query.difficulty) {
      filter.difficulty = req.query.difficulty;
    }

    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === "true";
    }

    const questions = await Question.find(filter)
      .populate("categoryId", "name slug")
      .populate("questionGroupId", "title slug groupType displayMode isActive")
      .sort({
        createdAt: -1,
      });

    res.status(200).json({
      success: true,
      count: questions.length,
      data: questions,
    });
  } catch (error) {
    logRuntimeError("questionController error:", error);

    res.status(500).json({
      success: false,
      message: getInternalErrorMessage(error),
    });
  }
};

// Update Question
const updateQuestion = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);

    const existingQuestion = await Question.findOne({
      _id: req.params.id,
      ...tenantFilter,
    });

    if (!existingQuestion) {
      return res.status(404).json({
        success: false,
        message: "Question not found or access denied",
      });
    }

    const containsImportMetadataMutation = (value) => {
      if (!value || typeof value !== "object") {
        return false;
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        if (
          key === "importMetadata" ||
          key.startsWith("importMetadata.")
        ) {
          return true;
        }

        if (containsImportMetadataMutation(nestedValue)) {
          return true;
        }
      }

      return false;
    };

    if (containsImportMetadataMutation(req.body || {})) {
      return res.status(400).json({
        success: false,
        message:
          "Import QA metadata cannot be changed through the normal question update endpoint",
      });
    }

    const updateData = {
      ...req.body,
      updatedBy: req.user._id,
    };

    delete updateData.tenantId;
    delete updateData.createdBy;
    delete updateData.externalQuestionKey;

    sanitizeQuestionGroupFields(updateData);

    if (existingQuestion.externalQuestionKey) {
      const existingImportMetadata = JSON.parse(
        JSON.stringify(existingQuestion.importMetadata || {})
      );

      updateData.importMetadata = {
        ...existingImportMetadata,
        contentStatus: "editorial_review_required",
        answerVerifiedBy: "",
        languageVerifiedBy: "",
        approvedBy: null,
        approvedAt: null,
      };
    }

    const mergedQuestionData = {
      ...existingQuestion.toObject(),
      ...updateData,
    };

    const contentError = validateQuestionContent(mergedQuestionData);

    if (contentError) {
      return res.status(400).json({
        success: false,
        message: contentError,
      });
    }

    const mcqError = validateMcqQuestion(mergedQuestionData);

    if (mcqError) {
      return res.status(400).json({
        success: false,
        message: mcqError,
      });
    }

    if (updateData.categoryId) {
      const categoryValidation = await validateCategoryAccess(
        updateData.categoryId,
        existingQuestion.tenantId
      );

      if (!categoryValidation.success) {
        return res.status(400).json({
          success: false,
          message: categoryValidation.message,
        });
      }
    }

    const questionGroupValidation = await validateQuestionGroupAccess(
      mergedQuestionData,
      existingQuestion.tenantId
    );

    if (!questionGroupValidation.success) {
      return res.status(400).json({
        success: false,
        message: questionGroupValidation.message,
      });
    }

    const question = await Question.findOneAndUpdate(
      {
        _id: req.params.id,
        ...tenantFilter,
      },
      updateData,
      {
        new: true,
        runValidators: true,
      }
    )
      .populate("categoryId", "name slug")
      .populate("questionGroupId", "title slug groupType displayMode isActive");

    res.status(200).json({
      success: true,
      data: question,
    });
  } catch (error) {
    logRuntimeError("questionController error:", error);

    res.status(500).json({
      success: false,
      message: getInternalErrorMessage(error),
    });
  }
};

// Disable Question
const disableQuestion = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);

    const question = await Question.findOneAndUpdate(
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

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found or access denied",
      });
    }

    res.status(200).json({
      success: true,
      message: "Question disabled successfully",
      data: question,
    });
  } catch (error) {
    logRuntimeError("questionController error:", error);

    res.status(500).json({
      success: false,
      message: getInternalErrorMessage(error),
    });
  }
};

module.exports = {
  createQuestion,
  dryRunQuestionBulkImport,
  executeQuestionBulkImport,
  getAllQuestions,
  updateQuestion,
  disableQuestion,
};