const mongoose = require("mongoose");
const Question = require("../models/Question");
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

// Create Question
const createQuestion = async (req, res) => {
  try {
    const tenantId = getRequestTenantId(req);

    const questionData = {
      ...req.body,
      tenantId,
      createdBy: req.user._id,
    };

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

    const question = await Question.create(questionData);

    res.status(201).json({
      success: true,
      data: question,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
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
      .sort({
        createdAt: -1,
      });

    res.status(200).json({
      success: true,
      count: questions.length,
      data: questions,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
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

    const updateData = {
      ...req.body,
      updatedBy: req.user._id,
    };

    delete updateData.tenantId;
    delete updateData.createdBy;

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
    ).populate("categoryId", "name slug");

    res.status(200).json({
      success: true,
      data: question,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
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
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  createQuestion,
  getAllQuestions,
  updateQuestion,
  disableQuestion,
};