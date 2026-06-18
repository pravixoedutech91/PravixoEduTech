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
const findQuestionInVersionBySnapshotId = (mockTestVersion, questionSnapshotId) => {
    const targetQuestionSnapshotId = String(questionSnapshotId);

    for (const section of mockTestVersion.sections || []) {
        for (const question of section.questions || []) {
            if (String(question._id) === targetQuestionSnapshotId) {
                return question;
            }
        }
    }

    return null;
};

const normalizeSelectedOptionId = (selectedOptionId) => {
    if (selectedOptionId === undefined) {
        return undefined;
    }

    if (selectedOptionId === null || selectedOptionId === "") {
        return null;
    }

    return String(selectedOptionId).trim().toUpperCase();
};

const buildAnswerStatus = ({ selectedOptionId, markedForReview, visited }) => {
    if (selectedOptionId && markedForReview) {
        return "answered_and_marked";
    }

    if (selectedOptionId) {
        return "answered";
    }

    if (markedForReview) {
        return "marked_for_review";
    }

    if (visited) {
        return "not_answered";
    }

    return "not_visited";
};

const sumAnswerTimeSpentSeconds = (answers) => {
    return (answers || []).reduce((total, answer) => {
        return total + toNumber(answer.timeSpentSeconds, 0);
    }, 0);
};

const buildSavedAnswerPayload = (attempt, answer) => {
    return {
        serverTime: new Date(),
        attempt: {
            _id: attempt._id,
            status: attempt.status,
            lastActivityAt: attempt.lastActivityAt,
            expiresAt: attempt.expiresAt,
            timeSpentSeconds: attempt.timeSpentSeconds,
        },
        answer: {
            sectionSlug: answer.sectionSlug,
            questionId: answer.questionId,
            questionSnapshotId: answer.questionSnapshotId,
            questionGroupId: answer.questionGroupId || null,
            groupQuestionOrder: answer.groupQuestionOrder || null,
            questionOrder: answer.questionOrder,
            selectedOptionId: answer.selectedOptionId || null,
            status: answer.status,
            visited: answer.visited,
            markedForReview: answer.markedForReview,
            confidenceLevel: answer.confidenceLevel,
            timeSpentSeconds: answer.timeSpentSeconds,
            answeredAt: answer.answeredAt,
        },
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
            message: resultAvailableImmediately
                ? "Attempt submitted successfully"
                : "Attempt submitted successfully. Result will be available later",
            data: buildSubmitAttemptPayload(attempt, resultAvailableImmediately),
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

const saveMockTestAnswer = async (req, res) => {
    try {
        const tenantId = getStudentTenantId(req);
        const studentId = req.user._id;
        const { attemptId } = req.params;

        const {
            questionSnapshotId,
            selectedOptionId,
            markedForReview,
            confidenceLevel,
            timeSpentSeconds,
        } = req.body || {};

        if (!mongoose.Types.ObjectId.isValid(attemptId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid attempt ID",
            });
        }

        if (!mongoose.Types.ObjectId.isValid(questionSnapshotId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid question snapshot ID",
            });
        }

        if (
            markedForReview !== undefined &&
            typeof markedForReview !== "boolean"
        ) {
            return res.status(400).json({
                success: false,
                message: "markedForReview must be true or false",
            });
        }

        const allowedConfidenceLevels = [
            "not_marked",
            "sure",
            "doubtful",
            "guess",
        ];

        if (
            confidenceLevel !== undefined &&
            !allowedConfidenceLevels.includes(confidenceLevel)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid confidence level",
            });
        }

        const attempt = await TestAttempt.findOne({
            _id: attemptId,
            tenantId,
            studentId,
            isActive: true,
        });

        if (!attempt) {
            return res.status(404).json({
                success: false,
                message: "Attempt not found or access denied",
            });
        }

        if (attempt.status !== "in_progress") {
            return res.status(403).json({
                success: false,
                message: "Only in-progress attempts can be updated",
            });
        }

        const now = new Date();

        if (attempt.expiresAt && attempt.expiresAt <= now) {
            attempt.status = "expired";
            attempt.lastActivityAt = now;
            await attempt.save();

            return res.status(403).json({
                success: false,
                message: "Attempt has expired",
            });
        }

        const mockTestVersion = await MockTestVersion.findOne({
            _id: attempt.mockTestVersionId,
            tenantId,
            isActive: true,
        });

        if (!mockTestVersion) {
            return res.status(404).json({
                success: false,
                message: "Mock test version not found",
            });
        }

        const question = findQuestionInVersionBySnapshotId(
            mockTestVersion,
            questionSnapshotId
        );

        if (!question) {
            return res.status(404).json({
                success: false,
                message: "Question not found in this attempt version",
            });
        }

        const attemptDetail = await getOrCreateAttemptDetail(
            tenantId,
            attempt,
            mockTestVersion
        );

        const answer = attemptDetail.answers.find((answerItem) => {
            return String(answerItem.questionSnapshotId) === String(questionSnapshotId);
        });

        if (!answer) {
            return res.status(404).json({
                success: false,
                message: "Question not found in attempt detail",
            });
        }

        const normalizedSelectedOptionId =
            normalizeSelectedOptionId(selectedOptionId);

        if (
            normalizedSelectedOptionId !== undefined &&
            normalizedSelectedOptionId !== null
        ) {
            const validOptionIds = (question.options || []).map((option) => {
                return option.optionId;
            });

            if (!validOptionIds.includes(normalizedSelectedOptionId)) {
                return res.status(400).json({
                    success: false,
                    message: "Selected option does not belong to this question",
                });
            }

            answer.selectedOptionId = normalizedSelectedOptionId;
            answer.answeredAt = now;
        }

        if (normalizedSelectedOptionId === null) {
            answer.selectedOptionId = undefined;
            answer.answeredAt = null;
        }

        answer.visited = true;

        if (markedForReview !== undefined) {
            answer.markedForReview = markedForReview;
        }

        if (confidenceLevel !== undefined) {
            answer.confidenceLevel = confidenceLevel;
        }

        if (timeSpentSeconds !== undefined) {
            const safeTimeSpentSeconds = Math.max(
                toNumber(timeSpentSeconds, 0),
                0
            );

            answer.timeSpentSeconds = Math.max(
                toNumber(answer.timeSpentSeconds, 0),
                safeTimeSpentSeconds
            );
        }

        answer.status = buildAnswerStatus({
            selectedOptionId: Boolean(answer.selectedOptionId),
            markedForReview: answer.markedForReview,
            visited: answer.visited,
        });

        attemptDetail.lastSyncedAt = now;
        attemptDetail.markModified("answers");
        await attemptDetail.save();

        const totalTimeSpentSeconds = sumAnswerTimeSpentSeconds(
            attemptDetail.answers
        );

        attempt.lastActivityAt = now;
        attempt.timeSpentSeconds =
            attempt.totalDurationSeconds > 0
                ? Math.min(totalTimeSpentSeconds, attempt.totalDurationSeconds)
                : totalTimeSpentSeconds;

        await attempt.save();

        res.status(200).json({
            success: true,
            message: "Answer saved successfully",
            data: buildSavedAnswerPayload(attempt, answer),
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const roundToTwo = (value) => {
    return Math.round((toNumber(value, 0) + Number.EPSILON) * 100) / 100;
};

const calculatePercentage = (score, maxScore) => {
    if (maxScore <= 0) {
        return 0;
    }

    return roundToTwo(Math.max(0, Math.min(100, (score / maxScore) * 100)));
};

const calculateAccuracy = (correct, attempted) => {
    if (attempted <= 0) {
        return 0;
    }

    return roundToTwo((correct / attempted) * 100);
};

const getSubmittedDetailExpiresAt = (baseDate, reviewRetentionDays) => {
    const safeRetentionDays = Math.max(
        toNumber(reviewRetentionDays, REVIEW_RETENTION_DAYS),
        1
    );

    return new Date(
        new Date(baseDate).getTime() + safeRetentionDays * 24 * 60 * 60 * 1000
    );
};

const createBasePerformanceSummary = () => {
    return {
        totalQuestions: 0,
        attempted: 0,
        correct: 0,
        wrong: 0,
        skipped: 0,
        score: 0,
        maxScore: 0,
        percentage: 0,
        accuracy: 0,
        timeSpentSeconds: 0,
    };
};

const finalizePerformanceSummary = (summary) => {
    summary.skipped = Math.max(summary.totalQuestions - summary.attempted, 0);
    summary.score = roundToTwo(summary.score);
    summary.maxScore = roundToTwo(summary.maxScore);
    summary.percentage = calculatePercentage(summary.score, summary.maxScore);
    summary.accuracy = calculateAccuracy(summary.correct, summary.attempted);
    summary.timeSpentSeconds = Math.max(
        toNumber(summary.timeSpentSeconds, 0),
        0
    );

    return summary;
};

const getOrCreateSummaryFromMap = (map, key, baseData) => {
    if (!map.has(key)) {
        map.set(key, {
            ...baseData,
            ...createBasePerformanceSummary(),
        });
    }

    return map.get(key);
};

const buildSubmittedAttemptSummaries = (mockTestVersion, attemptDetail) => {
    const answerBySnapshotId = new Map();

    for (const answer of attemptDetail.answers || []) {
        answerBySnapshotId.set(String(answer.questionSnapshotId), answer);
    }

    const scoreSummary = {
        totalQuestions: 0,
        attempted: 0,
        correct: 0,
        wrong: 0,
        skipped: 0,
        score: 0,
        maxScore: 0,
        percentage: 0,
        accuracy: 0,
        negativeMarks: 0,
    };

    const sectionMap = new Map();
    const topicMap = new Map();
    const difficultyMap = new Map();

    for (const section of mockTestVersion.sections || []) {
        const sectionSummary = getOrCreateSummaryFromMap(
            sectionMap,
            section.sectionSlug,
            {
                sectionSlug: section.sectionSlug,
                name: section.name,
                sectionType: section.sectionType,
            }
        );

        for (const question of section.questions || []) {
            const answer = answerBySnapshotId.get(String(question._id));
            const marks = toNumber(question.marks, 0);
            const negativeMarks = toNumber(question.negativeMarks, 0);
            const selectedOptionId = answer?.selectedOptionId || null;
            const questionTimeSpentSeconds = toNumber(
                answer?.timeSpentSeconds,
                0
            );

            const topicKey = [
                question.subject || "",
                question.topic || "",
                question.subTopic || "",
            ].join("|");

            const topicSummary = getOrCreateSummaryFromMap(topicMap, topicKey, {
                subject: question.subject || "",
                topic: question.topic || "",
                subTopic: question.subTopic || "",
            });

            const difficulty = question.difficulty || "medium";

            const difficultySummary = getOrCreateSummaryFromMap(
                difficultyMap,
                difficulty,
                {
                    difficulty,
                }
            );

            const summariesToUpdate = [
                sectionSummary,
                topicSummary,
                difficultySummary,
            ];

            scoreSummary.totalQuestions += 1;
            scoreSummary.maxScore += marks;

            for (const summary of summariesToUpdate) {
                summary.totalQuestions += 1;
                summary.maxScore += marks;
                summary.timeSpentSeconds += questionTimeSpentSeconds;
            }

            if (!answer) {
                continue;
            }

            answer.timeSpentSeconds = Math.max(questionTimeSpentSeconds, 0);

            if (!selectedOptionId) {
                answer.isCorrect = null;
                answer.marksAwarded = 0;
                answer.negativeMarksApplied = 0;
                continue;
            }

            const isCorrect = selectedOptionId === question.correctOptionId;
            const marksAwarded = isCorrect ? marks : 0;
            const negativeMarksApplied = isCorrect ? 0 : negativeMarks;

            answer.isCorrect = isCorrect;
            answer.marksAwarded = marksAwarded;
            answer.negativeMarksApplied = negativeMarksApplied;

            scoreSummary.attempted += 1;
            scoreSummary.score += marksAwarded - negativeMarksApplied;
            scoreSummary.negativeMarks += negativeMarksApplied;

            if (isCorrect) {
                scoreSummary.correct += 1;
            } else {
                scoreSummary.wrong += 1;
            }

            for (const summary of summariesToUpdate) {
                summary.attempted += 1;
                summary.score += marksAwarded - negativeMarksApplied;

                if (isCorrect) {
                    summary.correct += 1;
                } else {
                    summary.wrong += 1;
                }
            }
        }
    }

    scoreSummary.skipped = Math.max(
        scoreSummary.totalQuestions - scoreSummary.attempted,
        0
    );
    scoreSummary.score = roundToTwo(scoreSummary.score);
    scoreSummary.maxScore = roundToTwo(scoreSummary.maxScore);
    scoreSummary.negativeMarks = roundToTwo(scoreSummary.negativeMarks);
    scoreSummary.percentage = calculatePercentage(
        scoreSummary.score,
        scoreSummary.maxScore
    );
    scoreSummary.accuracy = calculateAccuracy(
        scoreSummary.correct,
        scoreSummary.attempted
    );

    return {
        scoreSummary,
        sectionSummaries: Array.from(sectionMap.values()).map(
            finalizePerformanceSummary
        ),
        topicSummaries: Array.from(topicMap.values()).map(
            finalizePerformanceSummary
        ),
        difficultySummaries: Array.from(difficultyMap.values()).map(
            finalizePerformanceSummary
        ),
    };
};

const isResultImmediatelyVisible = (mockTestVersion) => {
    return (
        mockTestVersion.settings?.showResultImmediately !== false &&
        mockTestVersion.examPatternSnapshot?.showResultImmediately !== false
    );
};

const buildSubmitAttemptPayload = (attempt, resultAvailable) => {
    const attemptPayload = {
        _id: attempt._id,
        attemptNumber: attempt.attemptNumber,
        status: attempt.status,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        expiresAt: attempt.expiresAt,
        totalDurationSeconds: attempt.totalDurationSeconds,
        timeSpentSeconds: attempt.timeSpentSeconds,
        review: attempt.review,
    };

    if (resultAvailable) {
        attemptPayload.scoreSummary = attempt.scoreSummary;
        attemptPayload.sectionSummaries = attempt.sectionSummaries;
        attemptPayload.topicSummaries = attempt.topicSummaries;
        attemptPayload.difficultySummaries = attempt.difficultySummaries;
    }

    return {
        serverTime: new Date(),
        resultAvailable,
        attempt: attemptPayload,
    };
};

const buildResultPayload = (attempt, mockTestVersion) => {
    return {
        serverTime: new Date(),
        resultAvailable: true,
        test: {
            _id: mockTestVersion._id,
            mockTestId: mockTestVersion.mockTestId,
            versionNumber: mockTestVersion.versionNumber,
            title: mockTestVersion.title,
            slug: mockTestVersion.slug,
            testType: mockTestVersion.testType,
            accessType: mockTestVersion.accessType,
            examPattern: {
                name: mockTestVersion.examPatternSnapshot?.name,
                examType: mockTestVersion.examPatternSnapshot?.examType,
                totalDurationMinutes:
                    mockTestVersion.examPatternSnapshot?.totalDurationMinutes,
            },
        },
        attempt: {
            _id: attempt._id,
            attemptNumber: attempt.attemptNumber,
            status: attempt.status,
            startedAt: attempt.startedAt,
            submittedAt: attempt.submittedAt,
            expiresAt: attempt.expiresAt,
            totalDurationSeconds: attempt.totalDurationSeconds,
            timeSpentSeconds: attempt.timeSpentSeconds,
            scoreSummary: attempt.scoreSummary,
            sectionSummaries: attempt.sectionSummaries,
            topicSummaries: attempt.topicSummaries,
            difficultySummaries: attempt.difficultySummaries,
            review: attempt.review,
        },
    };
};

const buildReviewAnswerMap = (attemptDetail) => {
    const answerMap = new Map();

    for (const answer of attemptDetail.answers || []) {
        answerMap.set(String(answer.questionSnapshotId), answer);
    }

    return answerMap;
};

const getDetailedReviewAccess = (attempt, now) => {
    const review = attempt.review || {};
    const solutionVisibility = review.solutionVisibility || "after_submit";

    if (solutionVisibility === "never") {
        return {
            allowed: false,
            message: "Detailed review is not available for this test",
        };
    }

    if (
        review.detailedReviewExpiresAt &&
        new Date(review.detailedReviewExpiresAt) <= now
    ) {
        return {
            allowed: false,
            message: "Detailed review has expired",
        };
    }

    if (!review.isDetailedReviewAvailable) {
        return {
            allowed: false,
            message: "Detailed review is not available yet",
        };
    }

    if (solutionVisibility === "after_submit") {
        return {
            allowed: true,
            message: "Detailed review available",
        };
    }

    if (solutionVisibility === "after_test_end") {
        if (attempt.expiresAt && new Date(attempt.expiresAt) <= now) {
            return {
                allowed: true,
                message: "Detailed review available",
            };
        }

        return {
            allowed: false,
            message: "Detailed review will be available after test end",
        };
    }

    return {
        allowed: false,
        message: "Detailed review is not available",
    };
};

const buildReviewQuestionPayload = (question, answer) => {
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

        correctOptionId: question.correctOptionId,
        explanationEn: question.explanationEn,
        explanationHi: question.explanationHi,
        explanationImageUrl: question.explanationImageUrl,

        marks: question.marks,
        negativeMarks: question.negativeMarks,
        difficulty: question.difficulty,
        tags: question.tags,
        order: question.order,

        studentAnswer: {
            selectedOptionId: answer?.selectedOptionId || null,
            isCorrect: answer?.isCorrect ?? null,
            marksAwarded: answer?.marksAwarded || 0,
            negativeMarksApplied: answer?.negativeMarksApplied || 0,
            timeSpentSeconds: answer?.timeSpentSeconds || 0,
            confidenceLevel: answer?.confidenceLevel || "not_marked",
            status: answer?.status || "not_visited",
            visited: answer?.visited || false,
            markedForReview: answer?.markedForReview || false,
            answeredAt: answer?.answeredAt || null,
        },
    };
};

const buildReviewSectionPayload = (section, answerMap) => {
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
            .map((question) => {
                const answer = answerMap.get(String(question._id));
                return buildReviewQuestionPayload(question, answer);
            }),
    };
};

const buildReviewPayload = (attempt, mockTestVersion, attemptDetail) => {
    const answerMap = buildReviewAnswerMap(attemptDetail);

    return {
        serverTime: new Date(),
        test: {
            _id: mockTestVersion._id,
            mockTestId: mockTestVersion.mockTestId,
            versionNumber: mockTestVersion.versionNumber,
            title: mockTestVersion.title,
            slug: mockTestVersion.slug,
            testType: mockTestVersion.testType,
            accessType: mockTestVersion.accessType,
        },
        attempt: {
            _id: attempt._id,
            attemptNumber: attempt.attemptNumber,
            status: attempt.status,
            startedAt: attempt.startedAt,
            submittedAt: attempt.submittedAt,
            expiresAt: attempt.expiresAt,
            totalDurationSeconds: attempt.totalDurationSeconds,
            timeSpentSeconds: attempt.timeSpentSeconds,
            scoreSummary: attempt.scoreSummary,
            sectionSummaries: attempt.sectionSummaries,
            topicSummaries: attempt.topicSummaries,
            difficultySummaries: attempt.difficultySummaries,
            review: attempt.review,
        },
        sections: (mockTestVersion.sections || [])
            .map((section) => buildReviewSectionPayload(section, answerMap))
            .sort((a, b) => Number(a.order || 1) - Number(b.order || 1)),
    };
};

const submitMockTestAttempt = async (req, res) => {
    try {
        const tenantId = getStudentTenantId(req);
        const studentId = req.user._id;
        const { attemptId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(attemptId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid attempt ID",
            });
        }

        const attempt = await TestAttempt.findOne({
            _id: attemptId,
            tenantId,
            studentId,
            isActive: true,
        });

        if (!attempt) {
            return res.status(404).json({
                success: false,
                message: "Attempt not found or access denied",
            });
        }

        if (attempt.status === "submitted") {
            return res.status(400).json({
                success: false,
                message: "Attempt already submitted",
            });
        }

        if (!["in_progress", "expired"].includes(attempt.status)) {
            return res.status(403).json({
                success: false,
                message: "Only in-progress or expired attempts can be submitted",
            });
        }

        const mockTestVersion = await MockTestVersion.findOne({
            _id: attempt.mockTestVersionId,
            tenantId,
            isActive: true,
        });

        if (!mockTestVersion) {
            return res.status(404).json({
                success: false,
                message: "Mock test version not found",
            });
        }

        const attemptDetail = await TestAttemptDetail.findOne({
            tenantId,
            attemptId: attempt._id,
            studentId,
        });

        if (!attemptDetail) {
            return res.status(404).json({
                success: false,
                message: "Attempt detail not found or already expired",
            });
        }

        const now = new Date();

        const {
            scoreSummary,
            sectionSummaries,
            topicSummaries,
            difficultySummaries,
        } = buildSubmittedAttemptSummaries(mockTestVersion, attemptDetail);

        const totalTimeSpentSeconds = sumAnswerTimeSpentSeconds(
            attemptDetail.answers
        );

        const reviewRetentionDays =
            attempt.review?.reviewRetentionDays || REVIEW_RETENTION_DAYS;

        const solutionVisibility =
            attempt.review?.solutionVisibility ||
            mockTestVersion.settings?.solutionVisibility ||
            "after_submit";

        const detailedReviewExpiresAt = getSubmittedDetailExpiresAt(
            now,
            reviewRetentionDays
        );

        const resultAvailableImmediately = isResultImmediatelyVisible(mockTestVersion);

        attempt.status = "submitted";
        attempt.submittedAt = now;
        attempt.lastActivityAt = now;
        attempt.timeSpentSeconds =
            attempt.totalDurationSeconds > 0
                ? Math.min(totalTimeSpentSeconds, attempt.totalDurationSeconds)
                : totalTimeSpentSeconds;

        attempt.scoreSummary = scoreSummary;
        attempt.sectionSummaries = sectionSummaries;
        attempt.topicSummaries = topicSummaries;
        attempt.difficultySummaries = difficultySummaries;
        attempt.review = {
            isDetailedReviewAvailable:
                resultAvailableImmediately && solutionVisibility === "after_submit",
            detailedReviewExpiresAt,
            solutionVisibility,
            reviewRetentionDays,
        };

        attemptDetail.lastSyncedAt = now;
        attemptDetail.expiresAt = detailedReviewExpiresAt;
        attemptDetail.markModified("answers");

        await attemptDetail.save();
        await attempt.save();

        res.status(200).json({
            success: true,
            message: "Attempt submitted successfully",
            data: buildSubmitAttemptPayload(attempt),
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const getMockTestResult = async (req, res) => {
    try {
        const tenantId = getStudentTenantId(req);
        const studentId = req.user._id;
        const { attemptId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(attemptId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid attempt ID",
            });
        }

        const attempt = await TestAttempt.findOne({
            _id: attemptId,
            tenantId,
            studentId,
            isActive: true,
        });

        if (!attempt) {
            return res.status(404).json({
                success: false,
                message: "Attempt not found or access denied",
            });
        }

        if (attempt.status !== "submitted") {
            return res.status(403).json({
                success: false,
                message: "Result is available only after submission",
            });
        }

        const mockTestVersion = await MockTestVersion.findOne({
            _id: attempt.mockTestVersionId,
            tenantId,
            isActive: true,
        });

        if (!mockTestVersion) {
            return res.status(404).json({
                success: false,
                message: "Mock test version not found",
            });
        }

        if (!isResultImmediatelyVisible(mockTestVersion)) {
            return res.status(403).json({
                success: false,
                message: "Result is not available yet",
            });
        }

        res.status(200).json({
            success: true,
            message: "Result fetched successfully",
            data: buildResultPayload(attempt, mockTestVersion),
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const getMockTestReview = async (req, res) => {
    try {
        const tenantId = getStudentTenantId(req);
        const studentId = req.user._id;
        const { attemptId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(attemptId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid attempt ID",
            });
        }

        const attempt = await TestAttempt.findOne({
            _id: attemptId,
            tenantId,
            studentId,
            isActive: true,
        });

        if (!attempt) {
            return res.status(404).json({
                success: false,
                message: "Attempt not found or access denied",
            });
        }

        if (attempt.status !== "submitted") {
            return res.status(403).json({
                success: false,
                message: "Review is available only after submission",
            });
        }

        const now = new Date();
        const reviewAccess = getDetailedReviewAccess(attempt, now);

        if (!reviewAccess.allowed) {
            return res.status(403).json({
                success: false,
                message: reviewAccess.message,
            });
        }

        const mockTestVersion = await MockTestVersion.findOne({
            _id: attempt.mockTestVersionId,
            tenantId,
            isActive: true,
        });

        if (!mockTestVersion) {
            return res.status(404).json({
                success: false,
                message: "Mock test version not found",
            });
        }

        const attemptDetail = await TestAttemptDetail.findOne({
            tenantId,
            attemptId: attempt._id,
            studentId,
        });

        if (!attemptDetail) {
            return res.status(404).json({
                success: false,
                message: "Review details not found or already expired",
            });
        }

        res.status(200).json({
            success: true,
            message: "Review fetched successfully",
            data: buildReviewPayload(attempt, mockTestVersion, attemptDetail),
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
    saveMockTestAnswer,
    submitMockTestAttempt,
    getMockTestResult,
    getMockTestReview,
};