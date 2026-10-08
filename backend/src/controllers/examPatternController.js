const {
  getInternalErrorMessage,
  logRuntimeError,
} = require("../utils/runtimeSecurity");
const mongoose = require("mongoose");
const ExamPattern = require("../models/ExamPattern");
const { getTenantFilter } = require("../middleware/tenantMiddleware");
const MockTest = require("../models/MockTest");
const MockTestVersion = require("../models/MockTestVersion");
const {
  validateExamTimingPolicy,
} = require("../utils/examTimingPolicy");

// Create Exam Pattern
const createExamPattern = async (req, res) => {
  try {
    const examPatternData = {
      ...req.body,
      tenantId: req.user.tenantId,
      createdBy: req.user._id,
    };

    const timingValidation = validateExamTimingPolicy({
      timingMode: examPatternData.timingMode,
      totalDurationMinutes: examPatternData.totalDurationMinutes,
      sections: examPatternData.sections || [],
    });

    if (!timingValidation.valid) {
      return res.status(400).json({
        success: false,
        message: timingValidation.message,
      });
    }

    examPatternData.timingMode = timingValidation.timingMode;

    const examPattern = await ExamPattern.create(examPatternData);

    res.status(201).json({
      success: true,
      data: examPattern,
    });
  } catch (error) {
    logRuntimeError("examPatternController error:", error);

    res.status(500).json({
      success: false,
      message: getInternalErrorMessage(error),
    });
  }
};

// Get All Exam Patterns
const getAllExamPatterns = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);

    const examPatterns = await ExamPattern.find(tenantFilter).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      count: examPatterns.length,
      data: examPatterns,
    });
  } catch (error) {
    logRuntimeError("examPatternController error:", error);

    res.status(500).json({
      success: false,
      message: getInternalErrorMessage(error),
    });
  }
};

// Update Exam Pattern
const updateExamPattern = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);

    const updateData = {
      ...req.body,
      updatedBy: req.user._id,
    };

    delete updateData.tenantId;
    delete updateData.createdBy;

    const existingExamPattern = await ExamPattern.findOne({
      _id: req.params.id,
      ...tenantFilter,
    });

    if (!existingExamPattern) {
      return res.status(404).json({
        success: false,
        message: "Exam pattern not found or access denied",
      });
    }

    const hasUpdateField = (field) =>
      Object.prototype.hasOwnProperty.call(updateData, field);

    const timingValidation = validateExamTimingPolicy({
      timingMode: hasUpdateField("timingMode")
        ? updateData.timingMode
        : existingExamPattern.timingMode,
      totalDurationMinutes: hasUpdateField("totalDurationMinutes")
        ? updateData.totalDurationMinutes
        : existingExamPattern.totalDurationMinutes,
      sections: hasUpdateField("sections")
        ? updateData.sections
        : existingExamPattern.sections,
    });

    if (!timingValidation.valid) {
      return res.status(400).json({
        success: false,
        message: timingValidation.message,
      });
    }

    updateData.timingMode = timingValidation.timingMode;

    const examPattern = await ExamPattern.findOneAndUpdate(
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

    if (!examPattern) {
      return res.status(404).json({
        success: false,
        message: "Exam pattern not found or access denied",
      });
    }

    res.status(200).json({
      success: true,
      data: examPattern,
    });
  } catch (error) {
    logRuntimeError("examPatternController error:", error);

    res.status(500).json({
      success: false,
      message: getInternalErrorMessage(error),
    });
  }
};

// Disable Exam Pattern
const disableExamPattern = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);

    const examPattern = await ExamPattern.findOneAndUpdate(
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

    if (!examPattern) {
      return res.status(404).json({
        success: false,
        message: "Exam pattern not found or access denied",
      });
    }

    res.status(200).json({
      success: true,
      message: "Exam pattern disabled successfully",
      data: examPattern,
    });
  } catch (error) {
    logRuntimeError("examPatternController error:", error);

    res.status(500).json({
      success: false,
      message: getInternalErrorMessage(error),
    });
  }
};

const deleteExamPattern = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid exam pattern ID",
      });
    }

    const examPattern = await ExamPattern.findOne({
      _id: id,
      ...tenantFilter,
    });

    if (!examPattern) {
      return res.status(404).json({
        success: false,
        message: "Exam pattern not found or access denied",
      });
    }

    const usedInMockTest = await MockTest.findOne({
      examPatternId: id,
      ...tenantFilter,
    }).select("_id title testType");

    if (usedInMockTest) {
      return res.status(409).json({
        success: false,
        message:
          "Exam pattern is already used and cannot be deleted. Disable it instead.",
        usedBy: {
          type: "MockTest",
          id: usedInMockTest._id,
          title: usedInMockTest.title,
          testType: usedInMockTest.testType,
        },
      });
    }

    const usedInPublishedVersion = await MockTestVersion.findOne({
      "examPatternSnapshot.examPatternId": id,
      ...tenantFilter,
    }).select("_id mockTestId versionNumber publishedAt");

    if (usedInPublishedVersion) {
      return res.status(409).json({
        success: false,
        message:
          "Exam pattern is already used in a published snapshot/version and cannot be deleted. Disable it instead.",
        usedBy: {
          type: "MockTestVersion",
          id: usedInPublishedVersion._id,
          mockTestId: usedInPublishedVersion.mockTestId,
          versionNumber: usedInPublishedVersion.versionNumber,
          publishedAt: usedInPublishedVersion.publishedAt,
        },
      });
    }

    await ExamPattern.deleteOne({
      _id: id,
      ...tenantFilter,
    });

    return res.status(200).json({
      success: true,
      message: "Exam pattern deleted successfully",
      data: {
        _id: examPattern._id,
        name: examPattern.name,
        slug: examPattern.slug,
      },
    });
  } catch (error) {
    logRuntimeError("Delete exam pattern error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete exam pattern",
    });
  }
};

module.exports = {
  createExamPattern,
  getAllExamPatterns,
  updateExamPattern,
  disableExamPattern,
  deleteExamPattern,
};