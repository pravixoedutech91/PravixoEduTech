const ExamPattern = require("../models/ExamPattern");
const { getTenantFilter } = require("../middleware/tenantMiddleware");

const validateSectionDuration = (totalDurationMinutes, sections) => {
  const sectionDurationTotal = sections.reduce(
    (total, section) => total + Number(section.durationMinutes || 0),
    0
  );

  return sectionDurationTotal === Number(totalDurationMinutes);
};

// Create Exam Pattern
const createExamPattern = async (req, res) => {
  try {
    const examPatternData = {
      ...req.body,
      tenantId: req.user.tenantId,
      createdBy: req.user._id,
    };

    if (
      !validateSectionDuration(
        examPatternData.totalDurationMinutes,
        examPatternData.sections || []
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Total duration must equal the sum of all section durations",
      });
    }

    const examPattern = await ExamPattern.create(examPatternData);

    res.status(201).json({
      success: true,
      data: examPattern,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
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
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
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

    if (updateData.totalDurationMinutes && updateData.sections) {
      if (
        !validateSectionDuration(
          updateData.totalDurationMinutes,
          updateData.sections
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Total duration must equal the sum of all section durations",
        });
      }
    }

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
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
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
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  createExamPattern,
  getAllExamPatterns,
  updateExamPattern,
  disableExamPattern,
};