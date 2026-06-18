const mongoose = require("mongoose");

const MockTest = require("../models/MockTest");
const MockTestVersion = require("../models/MockTestVersion");
const TestAttempt = require("../models/TestAttempt");
const TestAttemptDetail = require("../models/TestAttemptDetail");

const REVIEW_RETENTION_DAYS = 7;

const getStudentTenantId = (req) => {
    return req.user.tenantId;
};

const toNumber = (value, fallback = 0) => {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return fallback;
    }

    return number;
};

const buildStudentMockTestListItem = (mockTest) => {
    return {
        _id: mockTest._id,
        title: mockTest.title,
        slug: mockTest.slug,
        description: mockTest.description,
        testType: mockTest.testType,
        accessType: mockTest.accessType,
        price: mockTest.price,
        salePrice: mockTest.salePrice,
        isPurchasable: mockTest.isPurchasable,
        examPattern: mockTest.examPatternId
            ? {
                _id: mockTest.examPatternId._id,
                name: mockTest.examPatternId.name,
                examType: mockTest.examPatternId.examType,
                totalDurationMinutes: mockTest.examPatternId.totalDurationMinutes,
            }
            : null,
        activeVersion: mockTest.activeVersionId
            ? {
                _id: mockTest.activeVersionId._id,
                versionNumber: mockTest.activeVersionId.versionNumber,
                publishedAt: mockTest.activeVersionId.publishedAt,
            }
            : null,
        settings: {
            maxAttempts: mockTest.settings?.maxAttempts,
            interfaceMode: mockTest.settings?.interfaceMode,
            showResultImmediately: mockTest.settings?.showResultImmediately,
            solutionVisibility: mockTest.settings?.solutionVisibility,
        },
        publishedAt: mockTest.publishedAt,
    };
};

const sanitizeContentBlockForStudent = (block) => {
    return {
        blockType: block.blockType,
        textEn: block.textEn,
        textHi: block.textHi,
        imageUrl: block.imageUrl,
        altText: block.altText,
        captionEn: block.captionEn,
        captionHi: block.captionHi,
        latex: block.latex,
        tableData: block.tableData,
        order: block.order,
        isVisible: block.isVisible,
    };
};

const sanitizeQuestionGroupForStudent = (questionGroup) => {
    return {
        questionGroupId: questionGroup.questionGroupId,
        title: questionGroup.title,
        slug: questionGroup.slug,
        description: questionGroup.description,
        groupType: questionGroup.groupType,
        subject: questionGroup.subject,
        topic: questionGroup.topic,
        subTopic: questionGroup.subTopic,
        instructionEn: questionGroup.instructionEn,
        instructionHi: questionGroup.instructionHi,
        passageEn: questionGroup.passageEn,
        passageHi: questionGroup.passageHi,
        contentBlocks: [...(questionGroup.contentBlocks || [])]
            .filter((block) => block.isVisible !== false)
            .sort((a, b) => Number(a.order || 1) - Number(b.order || 1))
            .map(sanitizeContentBlockForStudent),
        displayMode: questionGroup.displayMode,
        expectedQuestionCount: questionGroup.expectedQuestionCount,
        difficulty: questionGroup.difficulty,
        tags: questionGroup.tags,
    };
};

const sanitizeOptionForStudent = (option) => {
    return {
        optionId: option.optionId,
        textEn: option.textEn,
        textHi: option.textHi,
        imageUrl: option.imageUrl,
    };
};

const sanitizeQuestionForStudent = (question) => {
    return {
        _id: question._id,
        questionId: question.questionId,
        questionGroupId: question.questionGroupId || null,
        groupQuestionOrder: question.groupQuestionOrder || null,
        questionType: question.questionType,
        sourceType: question.sourceType,
        subject: question.subject,
        topic: question.topic,
        subTopic: question.subTopic,
        questionTextEn: question.questionTextEn,
        questionTextHi: question.questionTextHi,
        questionImageUrl: question.questionImageUrl,
        options: (question.options || []).map(sanitizeOptionForStudent),
        marks: question.marks,
        negativeMarks: question.negativeMarks,
        difficulty: question.difficulty,
        tags: question.tags,
        order: question.order,
    };
};

const sanitizeSectionForStudent = (section) => {
    return {
        sectionSlug: section.sectionSlug,
        name: section.name,
        sectionType: section.sectionType,
        durationMinutes: section.durationMinutes,
        questionCount: section.questionCount,
        marksPerQuestion: section.marksPerQuestion,
        negativeMarks: section.negativeMarks,
        order: section.order,
        questionGroups: (section.questionGroups || []).map(
            sanitizeQuestionGroupForStudent
        ),
        questions: [...(section.questions || [])]
            .sort((a, b) => Number(a.order || 1) - Number(b.order || 1))
            .map(sanitizeQuestionForStudent),
    };
};

const buildSanitizedTestForStudent = (mockTestVersion) => {
    return {
        _id: mockTestVersion._id,
        mockTestId: mockTestVersion.mockTestId,
        versionNumber: mockTestVersion.versionNumber,
        title: mockTestVersion.title,
        slug: mockTestVersion.slug,
        description: mockTestVersion.description,
        testType: mockTestVersion.testType,
        accessType: mockTestVersion.accessType,
        instructionsEn: mockTestVersion.instructionsEn,
        instructionsHi: mockTestVersion.instructionsHi,
        examPatternSnapshot: {
            examPatternId: mockTestVersion.examPatternSnapshot?.examPatternId,
            name: mockTestVersion.examPatternSnapshot?.name,
            examType: mockTestVersion.examPatternSnapshot?.examType,
            totalDurationMinutes:
                mockTestVersion.examPatternSnapshot?.totalDurationMinutes,
            allowSectionSwitching:
                mockTestVersion.examPatternSnapshot?.allowSectionSwitching,
            allowQuestionNavigation:
                mockTestVersion.examPatternSnapshot?.allowQuestionNavigation,
            allowLanguageSwitching:
                mockTestVersion.examPatternSnapshot?.allowLanguageSwitching,
        },
        sections: (mockTestVersion.sections || [])
            .map(sanitizeSectionForStudent)
            .sort((a, b) => Number(a.order || 1) - Number(b.order || 1)),
        settings: {
            maxAttempts: mockTestVersion.settings?.maxAttempts,
            allowResume: mockTestVersion.settings?.allowResume,
            allowQuestionNavigation:
                mockTestVersion.settings?.allowQuestionNavigation,
            allowSectionSwitching: mockTestVersion.settings?.allowSectionSwitching,
            allowLanguageSwitching:
                mockTestVersion.settings?.allowLanguageSwitching,
            shuffleQuestions: mockTestVersion.settings?.shuffleQuestions,
            shuffleOptions: mockTestVersion.settings?.shuffleOptions,
            interfaceMode: mockTestVersion.settings?.interfaceMode,
            solutionVisibility: mockTestVersion.settings?.solutionVisibility,
        },
    };
};

const calculateTotalQuestions = (mockTestVersion) => {
    return (mockTestVersion.sections || []).reduce((total, section) => {
        return total + (section.questions || []).length;
    }, 0);
};

const calculateMaxScore = (mockTestVersion) => {
    return (mockTestVersion.sections || []).reduce((testTotal, section) => {
        const sectionScore = (section.questions || []).reduce(
            (sectionTotal, question) => {
                return sectionTotal + toNumber(question.marks, 0);
            },
            0
        );

        return testTotal + sectionScore;
    }, 0);
};

const calculateTotalDurationSeconds = (mockTestVersion) => {
    const patternMinutes = toNumber(
        mockTestVersion.examPatternSnapshot?.totalDurationMinutes,
        0
    );

    if (patternMinutes > 0) {
        return patternMinutes * 60;
    }

    const sectionMinutes = (mockTestVersion.sections || []).reduce(
        (total, section) => total + toNumber(section.durationMinutes, 0),
        0
    );

    return sectionMinutes * 60;
};

const getInProgressDetailExpiresAt = (attemptExpiresAt) => {
  if (!attemptExpiresAt) {
    return null;
  }

  return new Date(
    new Date(attemptExpiresAt).getTime() + 24 * 60 * 60 * 1000
  );
};

const buildInitialAnswersFromVersion = (mockTestVersion) => {
    const answers = [];

    for (const section of mockTestVersion.sections || []) {
        const sortedQuestions = [...(section.questions || [])].sort(
            (a, b) => Number(a.order || 1) - Number(b.order || 1)
        );

        sortedQuestions.forEach((question, index) => {
            answers.push({
                sectionSlug: section.sectionSlug,
                questionId: question.questionId,
                questionSnapshotId: question._id,
                questionGroupId: question.questionGroupId || null,
                groupQuestionOrder: question.groupQuestionOrder || null,
                questionOrder: question.order || index + 1,
                status: "not_visited",
                visited: false,
                markedForReview: false,
            });
        });
    }

    return answers;
};

const getNextAttemptNumber = async (tenantId, studentId, mockTestId) => {
    const latestAttempt = await TestAttempt.findOne({
        tenantId,
        studentId,
        mockTestId,
    })
        .sort({ attemptNumber: -1 })
        .select("attemptNumber");

    if (!latestAttempt) {
        return 1;
    }

    return Number(latestAttempt.attemptNumber) + 1;
};

const getOrCreateAttemptDetail = async (tenantId, attempt, mockTestVersion) => {
    const existingDetail = await TestAttemptDetail.findOne({
        tenantId,
        attemptId: attempt._id,
    });

    if (existingDetail) {
    const fallbackExpiresAt = getInProgressDetailExpiresAt(attempt.expiresAt);

    if (!existingDetail.expiresAt && fallbackExpiresAt) {
        existingDetail.expiresAt = fallbackExpiresAt;
        await existingDetail.save();
    }

    return existingDetail;
}

    return TestAttemptDetail.create({
        tenantId,
        attemptId: attempt._id,
        studentId: attempt.studentId,
        mockTestId: attempt.mockTestId,
        mockTestVersionId: attempt.mockTestVersionId,
        answers: buildInitialAnswersFromVersion(mockTestVersion),
        expiresAt: getInProgressDetailExpiresAt(attempt.expiresAt),
    });
};

const buildAttemptPayload = (attempt, mockTestVersion, resumed) => {
    return {
        resumed,
        serverTime: new Date(),
        attempt: {
            _id: attempt._id,
            attemptNumber: attempt.attemptNumber,
            status: attempt.status,
            startedAt: attempt.startedAt,
            lastActivityAt: attempt.lastActivityAt,
            expiresAt: attempt.expiresAt,
            totalDurationSeconds: attempt.totalDurationSeconds,
            timeSpentSeconds: attempt.timeSpentSeconds,
            review: attempt.review,
        },
        test: buildSanitizedTestForStudent(mockTestVersion),
    };
};

const getPublishedMockTestsForStudent = async (req, res) => {
    try {
        const tenantId = getStudentTenantId(req);

        const filter = {
            tenantId,
            isActive: true,
            isPublished: true,
        };

        if (req.query.testType) {
            filter.testType = req.query.testType;
        }

        if (req.query.accessType) {
            filter.accessType = req.query.accessType;
        }

        const mockTests = await MockTest.find(filter)
            .select(
                "title slug description testType accessType price salePrice isPurchasable examPatternId activeVersionId settings.maxAttempts settings.interfaceMode settings.showResultImmediately settings.solutionVisibility publishedAt createdAt"
            )
            .populate("examPatternId", "name examType totalDurationMinutes")
            .populate("activeVersionId", "versionNumber publishedAt")
            .sort({ publishedAt: -1, createdAt: -1 });

        res.status(200).json({
            success: true,
            count: mockTests.length,
            data: mockTests.map(buildStudentMockTestListItem),
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const startMockTestAttempt = async (req, res) => {
    try {
        const tenantId = getStudentTenantId(req);
        const studentId = req.user._id;
        const { mockTestId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(mockTestId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid mock test ID",
            });
        }

        const mockTest = await MockTest.findOne({
            _id: mockTestId,
            tenantId,
            isActive: true,
            isPublished: true,
        });

        if (!mockTest) {
            return res.status(404).json({
                success: false,
                message: "Mock test not found, unpublished, or access denied",
            });
        }

        if (mockTest.accessType === "paid") {
            return res.status(403).json({
                success: false,
                message: "Purchase required before starting this mock test",
            });
        }

        if (mockTest.accessType === "assigned") {
            return res.status(403).json({
                success: false,
                message: "This mock test requires assignment before access",
            });
        }

        if (!mockTest.activeVersionId) {
            return res.status(400).json({
                success: false,
                message: "Mock test has no active published version",
            });
        }

        const mockTestVersion = await MockTestVersion.findOne({
            _id: mockTest.activeVersionId,
            tenantId,
            isActive: true,
        });

        if (!mockTestVersion) {
            return res.status(404).json({
                success: false,
                message: "Active mock test version not found",
            });
        }

        const now = new Date();

        let existingAttempt = await TestAttempt.findOne({
            tenantId,
            studentId,
            mockTestId: mockTest._id,
            status: "in_progress",
            isActive: true,
        });

        if (
            existingAttempt &&
            existingAttempt.expiresAt &&
            existingAttempt.expiresAt <= now
        ) {
            existingAttempt.status = "expired";
            existingAttempt.lastActivityAt = now;
            await existingAttempt.save();
            existingAttempt = null;
        }

        if (existingAttempt) {
            existingAttempt.lastActivityAt = now;
            await existingAttempt.save();

            await getOrCreateAttemptDetail(tenantId, existingAttempt, mockTestVersion);

            return res.status(200).json({
                success: true,
                message: "Attempt resumed successfully",
                data: buildAttemptPayload(existingAttempt, mockTestVersion, true),
            });
        }

        const maxAttempts = Math.max(
            toNumber(mockTestVersion.settings?.maxAttempts, 1),
            1
        );

        const usedAttempts = await TestAttempt.countDocuments({
            tenantId,
            studentId,
            mockTestId: mockTest._id,
            status: { $in: ["in_progress", "submitted", "expired"] },
            isActive: true,
        });

        if (usedAttempts >= maxAttempts) {
            return res.status(403).json({
                success: false,
                message: "Maximum attempt limit reached for this mock test",
            });
        }

        const attemptNumber = await getNextAttemptNumber(
            tenantId,
            studentId,
            mockTest._id
        );

        const totalDurationSeconds =
            calculateTotalDurationSeconds(mockTestVersion);

        const expiresAt =
            totalDurationSeconds > 0
                ? new Date(now.getTime() + totalDurationSeconds * 1000)
                : null;

        let attempt = null;

        try {
            attempt = await TestAttempt.create({
                tenantId,
                studentId,
                mockTestId: mockTest._id,
                mockTestVersionId: mockTestVersion._id,
                attemptNumber,
                accessTypeAtAttempt: mockTestVersion.accessType || mockTest.accessType,
                status: "in_progress",
                startedAt: now,
                lastActivityAt: now,
                expiresAt,
                totalDurationSeconds,
                timeSpentSeconds: 0,
                scoreSummary: {
                    totalQuestions: calculateTotalQuestions(mockTestVersion),
                    maxScore: calculateMaxScore(mockTestVersion),
                },
                review: {
                    isDetailedReviewAvailable: false,
                    detailedReviewExpiresAt: null,
                    solutionVisibility:
                        mockTestVersion.settings?.solutionVisibility || "after_submit",
                    reviewRetentionDays: REVIEW_RETENTION_DAYS,
                },
            });

            await TestAttemptDetail.create({
                tenantId,
                attemptId: attempt._id,
                studentId,
                mockTestId: mockTest._id,
                mockTestVersionId: mockTestVersion._id,
                answers: buildInitialAnswersFromVersion(mockTestVersion),
                expiresAt: getInProgressDetailExpiresAt(expiresAt),
            });
        } catch (createError) {
            if (attempt) {
                await TestAttempt.deleteOne({ _id: attempt._id });
            }

            throw createError;
        }

        res.status(201).json({
            success: true,
            message: "Attempt started successfully",
            data: buildAttemptPayload(attempt, mockTestVersion, false),
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
    getPublishedMockTestsForStudent,
    startMockTestAttempt,
};