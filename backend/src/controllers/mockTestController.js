//---------------//
//Imports + Basic Helpers
//---------------//
const mongoose = require("mongoose");

const MockTest = require("../models/MockTest");
const MockTestVersion = require("../models/MockTestVersion");
const ExamPattern = require("../models/ExamPattern");
const Question = require("../models/Question");
const Category = require("../models/Category");

const { getTenantFilter } = require("../middleware/tenantMiddleware");

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

const getPatternSectionKey = (section) => {
  return (
    section.slug ||
    section.sectionSlug ||
    createSlugFromText(section.name)
  );
};

const getRequestTenantId = (req) => {
    if (req.user.role === "super_admin") {
        return req.body.tenantId || req.query.tenantId || req.user.tenantId;
    }

    return req.user.tenantId;
};

const forcePyqSettings = (mockTestData) => {
    if (mockTestData.testType !== "pyq") {
        return mockTestData;
    }

    mockTestData.settings = {
        ...(mockTestData.settings || {}),
        shuffleQuestions: false,
        shuffleOptions: false,
    };

    return mockTestData;
};
//validation
const validateBasicMockTestData = (mockTestData) => {
    if (!hasText(mockTestData.title)) {
        return "Mock test title is required";
    }

    if (!hasText(mockTestData.slug)) {
        return "Mock test slug is required";
    }

    if (!mockTestData.examPatternId) {
        return "Exam pattern is required";
    }

    if (!mongoose.Types.ObjectId.isValid(mockTestData.examPatternId)) {
        return "Invalid exam pattern ID";
    }

    if (!Array.isArray(mockTestData.sections)) {
        return "Sections are required";
    }

    if (mockTestData.sections.length === 0) {
        return "At least one section is required";
    }

    if (mockTestData.price !== undefined && Number(mockTestData.price) < 0) {
        return "Price cannot be negative";
    }

    if (
        mockTestData.salePrice !== undefined &&
        Number(mockTestData.salePrice) < 0
    ) {
        return "Sale price cannot be negative";
    }

    if (
        mockTestData.price !== undefined &&
        mockTestData.salePrice !== undefined &&
        Number(mockTestData.salePrice) > Number(mockTestData.price)
    ) {
        return "Sale price cannot be greater than price";
    }
    if (mockTestData.accessType === "paid") {
        const price = Number(mockTestData.price || 0);
        const salePrice = Number(mockTestData.salePrice || 0);
        const payableAmount = salePrice > 0 ? salePrice : price;

        if (payableAmount <= 0) {
            return "Paid mock test must have price or sale price greater than 0";
        }
    }
    return null;
};



const validateSections = (sections) => {
    const sectionSlugs = sections.map((section) => section.sectionSlug);

    const uniqueSectionSlugs = new Set(sectionSlugs);

    if (uniqueSectionSlugs.size !== sectionSlugs.length) {
        return "Section slugs must be unique";
    }

    for (const section of sections) {
        if (!hasText(section.sectionSlug)) {
            return "Each section must have a sectionSlug";
        }

        if (!hasText(section.name)) {
            return `Section ${section.sectionSlug} must have a name`;
        }

        if (Number(section.durationMinutes) < 0) {
            return `Section ${section.sectionSlug} duration cannot be negative`;
        }

        if (Number(section.questionCount) < 1) {
            return `Section ${section.sectionSlug} must have at least one question`;
        }

        if (Number(section.marksPerQuestion) < 0) {
            return `Section ${section.sectionSlug} marks cannot be negative`;
        }

        if (Number(section.negativeMarks) < 0) {
            return `Section ${section.sectionSlug} negative marks cannot be negative`;
        }

        if (Number(section.order) < 1) {
            return `Section ${section.sectionSlug} order must be at least 1`;
        }

        if (!Array.isArray(section.questions)) {
            return `Section ${section.sectionSlug} questions must be an array`;
        }

        if (section.questions.length > Number(section.questionCount)) {
            return `Section ${section.sectionSlug} has more questions than allowed`;
        }

        const questionIds = section.questions.map((question) =>
            String(question.questionId)
        );

        const uniqueQuestionIds = new Set(questionIds);

        if (uniqueQuestionIds.size !== questionIds.length) {
            return `Duplicate questions found in section ${section.sectionSlug}`;
        }

        for (const question of section.questions) {
            if (!question.questionId) {
                return `Each question in section ${section.sectionSlug} must have questionId`;
            }

            if (!mongoose.Types.ObjectId.isValid(question.questionId)) {
                return `Invalid question ID in section ${section.sectionSlug}`;
            }

            if (question.order !== undefined && Number(question.order) < 1) {
                return `Question order in section ${section.sectionSlug} must be at least 1`;
            }
        }
    }

    return null;
};

const validateQuestionDuplicatesAcrossTest = (sections) => {
    const allQuestionIds = [];

    for (const section of sections) {
        for (const question of section.questions || []) {
            allQuestionIds.push(String(question.questionId));
        }
    }

    const uniqueQuestionIds = new Set(allQuestionIds);

    if (uniqueQuestionIds.size !== allQuestionIds.length) {
        return "Same question cannot be used multiple times in one mock test";
    }

    return null;
};

const validateExamPatternAccess = async (examPatternId, tenantId) => {
    const examPattern = await ExamPattern.findOne({
        _id: examPatternId,
        tenantId,
        isActive: true,
    });

    if (!examPattern) {
        return {
            success: false,
            message: "Exam pattern not found or access denied",
        };
    }

    return {
        success: true,
        examPattern,
    };
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
        isActive: true,
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

const validateSectionsAgainstPattern = (sections, examPattern) => {
  const patternSections = examPattern.sections || [];

  if (sections.length !== patternSections.length) {
    return "Mock test sections must match selected exam pattern sections";
  }

  const patternSectionMap = new Map();

  for (const patternSection of patternSections) {
    const patternSectionKey = getPatternSectionKey(patternSection);

    if (!patternSectionKey) {
      return "Every exam pattern section must have name, slug, or sectionSlug";
    }

    if (patternSectionMap.has(patternSectionKey)) {
      return "Exam pattern has duplicate section names/slugs";
    }

    patternSectionMap.set(patternSectionKey, patternSection);
  }

  for (const section of sections) {
    const sectionKey = createSlugFromText(section.sectionSlug);
    const patternSection = patternSectionMap.get(sectionKey);

    if (!patternSection) {
      return `Section ${section.sectionSlug} does not exist in selected exam pattern`;
    }

    if (
      Number(section.durationMinutes) !==
      Number(patternSection.durationMinutes)
    ) {
      return `Section ${section.sectionSlug} duration must match exam pattern`;
    }

    if (Number(section.questionCount) !== Number(patternSection.questionCount)) {
      return `Section ${section.sectionSlug} question count must match exam pattern`;
    }

    if (
      Number(section.marksPerQuestion) !==
      Number(patternSection.marksPerQuestion)
    ) {
      return `Section ${section.sectionSlug} marks must match exam pattern`;
    }

    if (Number(section.negativeMarks) !== Number(patternSection.negativeMarks)) {
      return `Section ${section.sectionSlug} negative marks must match exam pattern`;
    }
  }

  return null;
};


const validateQuestionAccess = async (sections, tenantId) => {
    const questionIds = [];

    for (const section of sections) {
        for (const question of section.questions || []) {
            questionIds.push(question.questionId);
        }
    }

    if (questionIds.length === 0) {
        return {
            success: true,
            questionMap: new Map(),
        };
    }

    const questions = await Question.find({
        _id: { $in: questionIds },
        tenantId,
        isActive: true,
        questionType: "mcq",
    });

    if (questions.length !== questionIds.length) {
        return {
            success: false,
            message:
                "One or more questions were not found, are inactive, or are not MCQ questions",
        };
    }

    const questionMap = new Map();

    for (const question of questions) {
        questionMap.set(String(question._id), question);
    }

    return {
        success: true,
        questionMap,
    };
};

const validatePublishReady = (mockTest) => {
    for (const section of mockTest.sections) {
        if (section.questions.length !== Number(section.questionCount)) {
            return `Section ${section.sectionSlug} must have exactly ${section.questionCount} questions before publishing`;
        }
    }

    return null;
};

const buildQuestionSnapshot = (question, section, order) => {
    return {
        questionId: question._id,
        questionType: question.questionType,
        sourceType: question.sourceType,
        subject: question.subject,
        topic: question.topic,
        subTopic: question.subTopic,
        questionTextEn: question.questionTextEn,
        questionTextHi: question.questionTextHi,
        questionImageUrl: question.questionImageUrl,
        options: question.options,
        correctOptionId: question.correctOptionId,
        explanationEn: question.explanationEn,
        explanationHi: question.explanationHi,
        explanationImageUrl: question.explanationImageUrl,
        marks: section.marksPerQuestion,
        negativeMarks: section.negativeMarks,
        difficulty: question.difficulty,
        tags: question.tags,
        order,
    };
};

const buildExamPatternSnapshot = (examPattern) => {
    return {
        examPatternId: examPattern._id,
        name: examPattern.name,
        examType: examPattern.examType,
        totalDurationMinutes: examPattern.totalDurationMinutes,
        allowSectionSwitching: examPattern.allowSectionSwitching,
        allowQuestionNavigation: examPattern.allowQuestionNavigation,
        allowLanguageSwitching: examPattern.allowLanguageSwitching,
        showResultImmediately: examPattern.showResultImmediately,
        shuffleQuestions: examPattern.shuffleQuestions,
        shuffleOptions: examPattern.shuffleOptions,
    };
};

const buildSectionSnapshots = (mockTest, questionMap) => {
    return mockTest.sections
        .map((section) => {
            const sortedQuestions = [...section.questions].sort(
                (a, b) => Number(a.order || 1) - Number(b.order || 1)
            );

            return {
                sectionSlug: section.sectionSlug,
                name: section.name,
                sectionType: section.sectionType,
                durationMinutes: section.durationMinutes,
                questionCount: section.questionCount,
                marksPerQuestion: section.marksPerQuestion,
                negativeMarks: section.negativeMarks,
                order: section.order,
                questions: sortedQuestions.map((questionItem, index) => {
                    const question = questionMap.get(String(questionItem.questionId));

                    return buildQuestionSnapshot(
                        question,
                        section,
                        questionItem.order || index + 1
                    );
                }),
            };
        })
        .sort((a, b) => Number(a.order) - Number(b.order));
};

const getNextVersionNumber = async (mockTestId, tenantId) => {
    const latestVersion = await MockTestVersion.findOne({
        mockTestId,
        tenantId,
    }).sort({ versionNumber: -1 });

    if (!latestVersion) {
        return 1;
    }

    return latestVersion.versionNumber + 1;
};


const createMockTest = async (req, res) => {
    try {
        const tenantId = getRequestTenantId(req);

        let mockTestData = {
            ...req.body,
            tenantId,
            createdBy: req.user._id,
        };

        delete mockTestData._id;
        delete mockTestData.__v;
        delete mockTestData.updatedBy;
        delete mockTestData.createdAt;
        delete mockTestData.updatedAt;

        mockTestData = forcePyqSettings(mockTestData);

        mockTestData.isPublished = false;
        mockTestData.activeVersionId = undefined;
        mockTestData.publishedAt = undefined;

        const basicError = validateBasicMockTestData(mockTestData);

        if (basicError) {
            return res.status(400).json({
                success: false,
                message: basicError,
            });
        }

        const sectionError = validateSections(mockTestData.sections);

        if (sectionError) {
            return res.status(400).json({
                success: false,
                message: sectionError,
            });
        }

        const duplicateQuestionError = validateQuestionDuplicatesAcrossTest(
            mockTestData.sections
        );

        if (duplicateQuestionError) {
            return res.status(400).json({
                success: false,
                message: duplicateQuestionError,
            });
        }

        const examPatternValidation = await validateExamPatternAccess(
            mockTestData.examPatternId,
            tenantId
        );

        if (!examPatternValidation.success) {
            return res.status(400).json({
                success: false,
                message: examPatternValidation.message,
            });
        }

        const patternError = validateSectionsAgainstPattern(
            mockTestData.sections,
            examPatternValidation.examPattern
        );

        if (patternError) {
            return res.status(400).json({
                success: false,
                message: patternError,
            });
        }

        const categoryValidation = await validateCategoryAccess(
            mockTestData.categoryId,
            tenantId
        );

        if (!categoryValidation.success) {
            return res.status(400).json({
                success: false,
                message: categoryValidation.message,
            });
        }

        const questionValidation = await validateQuestionAccess(
            mockTestData.sections,
            tenantId
        );

        if (!questionValidation.success) {
            return res.status(400).json({
                success: false,
                message: questionValidation.message,
            });
        }

        const mockTest = await MockTest.create(mockTestData);

        res.status(201).json({
            success: true,
            data: mockTest,
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


const getAllMockTests = async (req, res) => {
    try {
        const tenantFilter = getTenantFilter(req);

        const filter = {
            ...tenantFilter,
        };

        if (req.query.testType) {
            filter.testType = req.query.testType;
        }

        if (req.query.accessType) {
            filter.accessType = req.query.accessType;
        }

        if (req.query.isPublished !== undefined) {
            filter.isPublished = req.query.isPublished === "true";
        }

        if (req.query.isActive !== undefined) {
            filter.isActive = req.query.isActive === "true";
        }

        const mockTests = await MockTest.find(filter)
            .populate("examPatternId", "name slug examType totalDurationMinutes")
            .populate("categoryId", "name slug")
            .populate("activeVersionId", "versionNumber publishedAt")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: mockTests.length,
            data: mockTests,
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const getSingleMockTest = async (req, res) => {
    try {
        const tenantFilter = getTenantFilter(req);

        const mockTest = await MockTest.findOne({
            _id: req.params.id,
            ...tenantFilter,
        })
            .populate("examPatternId", "name slug examType totalDurationMinutes")
            .populate("categoryId", "name slug")
            .populate("activeVersionId", "versionNumber publishedAt");

        if (!mockTest) {
            return res.status(404).json({
                success: false,
                message: "Mock test not found or access denied",
            });
        }


        res.status(200).json({
            success: true,
            data: mockTest,
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


const updateMockTest = async (req, res) => {
    try {
        const tenantFilter = getTenantFilter(req);

        const existingMockTest = await MockTest.findOne({
            _id: req.params.id,
            ...tenantFilter,
        });

        if (!existingMockTest) {
            return res.status(404).json({
                success: false,
                message: "Mock test not found or access denied",
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
        delete updateData.isPublished;
        delete updateData.activeVersionId;
        delete updateData.publishedAt;

        if (updateData.settings) {
            const existingSettings = JSON.parse(
                JSON.stringify(existingMockTest.settings || {})
            );

            updateData.settings = {
                ...existingSettings,
                ...updateData.settings,
            };
        }

        const mergedMockTestData = {
            ...existingMockTest.toObject(),
            ...updateData,
        };

        forcePyqSettings(mergedMockTestData);

        if (mergedMockTestData.testType === "pyq") {
            updateData.settings = mergedMockTestData.settings;
        }

        const basicError = validateBasicMockTestData(mergedMockTestData);

        if (basicError) {
            return res.status(400).json({
                success: false,
                message: basicError,
            });
        }

        const sectionError = validateSections(mergedMockTestData.sections);

        if (sectionError) {
            return res.status(400).json({
                success: false,
                message: sectionError,
            });
        }

        const duplicateQuestionError = validateQuestionDuplicatesAcrossTest(
            mergedMockTestData.sections
        );

        if (duplicateQuestionError) {
            return res.status(400).json({
                success: false,
                message: duplicateQuestionError,
            });
        }

        const examPatternValidation = await validateExamPatternAccess(
            mergedMockTestData.examPatternId,
            existingMockTest.tenantId
        );

        if (!examPatternValidation.success) {
            return res.status(400).json({
                success: false,
                message: examPatternValidation.message,
            });
        }

        const patternError = validateSectionsAgainstPattern(
            mergedMockTestData.sections,
            examPatternValidation.examPattern
        );

        if (patternError) {
            return res.status(400).json({
                success: false,
                message: patternError,
            });
        }

        if (mergedMockTestData.categoryId) {
            const categoryValidation = await validateCategoryAccess(
                mergedMockTestData.categoryId,
                existingMockTest.tenantId
            );

            if (!categoryValidation.success) {
                return res.status(400).json({
                    success: false,
                    message: categoryValidation.message,
                });
            }
        }

        const questionValidation = await validateQuestionAccess(
            mergedMockTestData.sections,
            existingMockTest.tenantId
        );

        if (!questionValidation.success) {
            return res.status(400).json({
                success: false,
                message: questionValidation.message,
            });
        }

        const mockTest = await MockTest.findOneAndUpdate(
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
            .populate("examPatternId", "name slug examType totalDurationMinutes")
            .populate("categoryId", "name slug")
            .populate("activeVersionId", "versionNumber publishedAt");

        res.status(200).json({
            success: true,
            data: mockTest,
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


const disableMockTest = async (req, res) => {
    try {
        const tenantFilter = getTenantFilter(req);

        const mockTest = await MockTest.findOneAndUpdate(
            {
                _id: req.params.id,
                ...tenantFilter,
            },
            {
                isActive: false,
                isPublished: false,
                updatedBy: req.user._id,
            },
            {
                new: true,
                runValidators: true,
            }
        );

        if (!mockTest) {
            return res.status(404).json({
                success: false,
                message: "Mock test not found or access denied",
            });
        }

        res.status(200).json({
            success: true,
            message: "Mock test disabled successfully",
            data: mockTest,
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const unpublishMockTest = async (req, res) => {
    try {
        const tenantFilter = getTenantFilter(req);

        const mockTest = await MockTest.findOneAndUpdate(
            {
                _id: req.params.id,
                ...tenantFilter,
            },
            {
                isPublished: false,
                updatedBy: req.user._id,
            },
            {
                new: true,
                runValidators: true,
            }
        );

        if (!mockTest) {
            return res.status(404).json({
                success: false,
                message: "Mock test not found or access denied",
            });
        }

        res.status(200).json({
            success: true,
            message: "Mock test unpublished successfully",
            data: mockTest,
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


const publishMockTest = async (req, res) => {
    try {
        const tenantFilter = getTenantFilter(req);

        const mockTest = await MockTest.findOne({
            _id: req.params.id,
            ...tenantFilter,
            isActive: true,
        });

        if (!mockTest) {
            return res.status(404).json({
                success: false,
                message: "Mock test not found or access denied",
            });
        }

        const basicError = validateBasicMockTestData(mockTest.toObject());

        if (basicError) {
            return res.status(400).json({
                success: false,
                message: basicError,
            });
        }

        const publishError = validatePublishReady(mockTest);

        if (publishError) {
            return res.status(400).json({
                success: false,
                message: publishError,
            });
        }

        const duplicateQuestionError = validateQuestionDuplicatesAcrossTest(
            mockTest.sections
        );

        if (duplicateQuestionError) {
            return res.status(400).json({
                success: false,
                message: duplicateQuestionError,
            });
        }

        const examPatternValidation = await validateExamPatternAccess(
            mockTest.examPatternId,
            mockTest.tenantId
        );

        if (!examPatternValidation.success) {
            return res.status(400).json({
                success: false,
                message: examPatternValidation.message,
            });
        }

        const patternError = validateSectionsAgainstPattern(
            mockTest.sections,
            examPatternValidation.examPattern
        );

        if (patternError) {
            return res.status(400).json({
                success: false,
                message: patternError,
            });
        }

        const questionValidation = await validateQuestionAccess(
            mockTest.sections,
            mockTest.tenantId
        );

        if (!questionValidation.success) {
            return res.status(400).json({
                success: false,
                message: questionValidation.message,
            });
        }

        const settings = JSON.parse(JSON.stringify(mockTest.settings || {}));

        if (mockTest.testType === "pyq") {
            settings.shuffleQuestions = false;
            settings.shuffleOptions = false;
        }

        const versionNumber = await getNextVersionNumber(
            mockTest._id,
            mockTest.tenantId
        );

        const mockTestVersion = await MockTestVersion.create({
            tenantId: mockTest.tenantId,
            mockTestId: mockTest._id,
            versionNumber,
            title: mockTest.title,
            slug: mockTest.slug,
            description: mockTest.description,
            testType: mockTest.testType,
            accessType: mockTest.accessType,
            price: mockTest.price,
            salePrice: mockTest.salePrice,
            instructionsEn: mockTest.instructionsEn,
            instructionsHi: mockTest.instructionsHi,
            examPatternSnapshot: buildExamPatternSnapshot(
                examPatternValidation.examPattern
            ),
            sections: buildSectionSnapshots(mockTest, questionValidation.questionMap),
            settings,
            publishedBy: req.user._id,
        });

        mockTest.isPublished = true;
        mockTest.activeVersionId = mockTestVersion._id;
        mockTest.publishedAt = new Date();
        mockTest.settings = settings;
        mockTest.updatedBy = req.user._id;

        mockTest.markModified("settings");

        await mockTest.save();

        res.status(201).json({
            success: true,
            message: "Mock test published successfully",
            data: {
                mockTest,
                version: mockTestVersion,
            },
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
    createMockTest,
    getAllMockTests,
    getSingleMockTest,
    updateMockTest,
    disableMockTest,
    publishMockTest,
    unpublishMockTest,
};