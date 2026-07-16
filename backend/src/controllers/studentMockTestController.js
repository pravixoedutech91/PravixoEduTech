const mongoose = require("mongoose");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const MockTest = require("../models/MockTest");
const MockTestVersion = require("../models/MockTestVersion");
const TestAttempt = require("../models/TestAttempt");
const TestAttemptDetail = require("../models/TestAttemptDetail");
const PaymentProduct = require("../models/PaymentProduct");
const Purchase = require("../models/Purchase");
const Entitlement = require("../models/Entitlement");

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

const buildStudentMockTestListItem = (
    mockTest,
    studentAttemptSummary = null
) => {
    const activeVersionSettings =
        mockTest.activeVersionId?.settings || mockTest.settings || {};

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
            maxAttempts: activeVersionSettings?.maxAttempts,
            interfaceMode: activeVersionSettings?.interfaceMode,
            showResultImmediately: activeVersionSettings?.showResultImmediately,
            solutionVisibility: activeVersionSettings?.solutionVisibility,
        },
        publishedAt: mockTest.publishedAt,
        studentAttemptSummary,
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

const buildAttemptAnswerStatePayload = (attemptDetail) => {
    return (attemptDetail?.answers || []).map((answer) => ({
        questionSnapshotId: answer.questionSnapshotId,
        selectedOptionId: answer.selectedOptionId || null,
        markedForReview: Boolean(answer.markedForReview),
        status: answer.status || "not_visited",
        visited: Boolean(answer.visited),
        timeSpentSeconds: toNumber(answer.timeSpentSeconds, 0),
        answeredAt: answer.answeredAt || null,
    }));
};

const buildAttemptPayload = (
    attempt,
    mockTestVersion,
    resumed,
    attemptDetail = null
) => {
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
            review: buildReviewMetadataForStudent(attempt),
        },
        test: buildSanitizedTestForStudent(mockTestVersion),
        answers: buildAttemptAnswerStatePayload(attemptDetail),
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

const ATTEMPT_LIMIT_COUNT_STATUSES = ["in_progress", "submitted", "expired"];

const getAttemptIdForSummary = (attempt) => {
    if (!attempt) {
        return null;
    }

    return String(attempt._id);
};

const syncExpiredInProgressAttempts = async ({
    tenantId,
    studentId,
    mockTestIds = null,
    mockTestId = null,
    now = new Date(),
}) => {
    if (!tenantId || !studentId) {
        return 0;
    }

    const filter = {
        tenantId,
        studentId,
        status: "in_progress",
        isActive: true,
        expiresAt: { $ne: null, $lte: now },
    };

    if (Array.isArray(mockTestIds) && mockTestIds.length > 0) {
        filter.mockTestId = { $in: mockTestIds };
    } else if (mockTestId) {
        filter.mockTestId = mockTestId;
    }

    const result = await TestAttempt.updateMany(filter, {
        $set: {
            status: "expired",
            lastActivityAt: now,
        },
    });

    return result.modifiedCount || result.nModified || 0;
};

const isAttemptResumableForSummary = (attempt, now) => {
    if (!attempt || attempt.status !== "in_progress") {
        return false;
    }

    if (!attempt.expiresAt) {
        return true;
    }

    return new Date(attempt.expiresAt) > now;
};

const getPrimaryMockTestAction = ({
    canResume,
    canViewReview,
    canViewResult,
    canRetake,
    isAttemptLimitReached,
}) => {
    if (canResume) {
        return "resume";
    }

    if (canViewReview) {
        return "view_review";
    }

    if (canViewResult) {
        return "view_result";
    }

    if (canRetake) {
        return "retake";
    }

    if (isAttemptLimitReached) {
        return "limit_reached";
    }

    return "start";
};

const groupAttemptsByMockTestId = (attempts) => {
    const attemptsByMockTestId = new Map();

    for (const attempt of attempts || []) {
        const key = String(attempt.mockTestId);

        if (!attemptsByMockTestId.has(key)) {
            attemptsByMockTestId.set(key, []);
        }

        attemptsByMockTestId.get(key).push(attempt);
    }

    return attemptsByMockTestId;
};

const buildStudentAttemptSummary = (
    mockTest,
    attempts = [],
    now = new Date()
) => {
    const activeVersionSettings =
        mockTest.activeVersionId?.settings || mockTest.settings || {};

    const maxAttempts = Math.max(toNumber(activeVersionSettings?.maxAttempts, 1), 1);

    const attemptsUsed = attempts.filter((attempt) =>
        ATTEMPT_LIMIT_COUNT_STATUSES.includes(attempt.status)
    ).length;

    const attemptsRemaining = Math.max(maxAttempts - attemptsUsed, 0);

    const latestAttempt = attempts[0] || null;

    const resumableAttempt = attempts.find((attempt) =>
        isAttemptResumableForSummary(attempt, now)
    );

    const latestSubmittedAttempt = attempts.find((attempt) => {
        return attempt.status === "submitted";
    });

    const latestSubmittedVersion = latestSubmittedAttempt?.mockTestVersionId;
    const hasResultVisibilityData = Boolean(
        latestSubmittedVersion &&
            typeof latestSubmittedVersion === "object" &&
            (latestSubmittedVersion.settings ||
                latestSubmittedVersion.examPatternSnapshot)
    );

    const review = latestSubmittedAttempt
        ? buildReviewMetadataForStudent(latestSubmittedAttempt, now)
        : {
            isDetailedReviewAvailable: false,
            detailedReviewExpiresAt: null,
            solutionVisibility: null,
            reviewRetentionDays: REVIEW_RETENTION_DAYS,
        };

    const canResume = Boolean(resumableAttempt);

    const canViewResult = Boolean(
        latestSubmittedAttempt &&
            hasResultVisibilityData &&
            isResultImmediatelyVisible(latestSubmittedVersion)
    );

    const canViewReview = Boolean(
        latestSubmittedAttempt && review.isDetailedReviewAvailable
    );

    const latestInProgressExpired = Boolean(
        latestAttempt &&
            latestAttempt.status === "in_progress" &&
            !isAttemptResumableForSummary(latestAttempt, now)
    );

    const canRetake = Boolean(
        !canResume &&
            latestAttempt &&
            attemptsRemaining > 0 &&
            (["submitted", "expired", "abandoned"].includes(
                latestAttempt.status
            ) ||
                latestInProgressExpired)
    );

    const canStart = Boolean(!latestAttempt && attemptsRemaining > 0);

    const isAttemptLimitReached = Boolean(
        attemptsUsed >= maxAttempts && !canResume
    );

    const primaryAction = getPrimaryMockTestAction({
        canResume,
        canViewReview,
        canViewResult,
        canRetake,
        isAttemptLimitReached,
    });

    return {
        maxAttempts,
        attemptsUsed,
        attemptsRemaining,

        latestAttemptId: getAttemptIdForSummary(latestAttempt),
        latestAttemptNumber: latestAttempt?.attemptNumber || null,
        latestAttemptStatus: latestAttempt?.status || null,
        latestAttemptStartedAt: latestAttempt?.startedAt || null,
        latestAttemptSubmittedAt: latestAttempt?.submittedAt || null,
        latestAttemptExpiresAt: latestAttempt?.expiresAt || null,

        resumeAttemptId: getAttemptIdForSummary(resumableAttempt),

        canStart,
        canResume,
        canViewResult,
        canViewReview,
        canRetake,
        isAttemptLimitReached,

        primaryAction,

        result: {
            attemptId: getAttemptIdForSummary(latestSubmittedAttempt),
            isResultVisible: canViewResult,
        },

        review: {
            ...review,
            attemptId: getAttemptIdForSummary(latestSubmittedAttempt),
        },
    };
};



const getRazorpayConfig = () => {
    const keyId = process.env.RAZORPAY_KEY_ID || "";
    const keySecret = process.env.RAZORPAY_KEY_SECRET || "";

    return {
        keyId: keyId.trim(),
        keySecret: keySecret.trim(),
    };
};

const getRazorpayClient = () => {
    const config = getRazorpayConfig();

    if (!config.keyId || !config.keySecret) {
        return {
            error: "Razorpay test keys are not configured on backend",
        };
    }

    return {
        client: new Razorpay({
            key_id: config.keyId,
            key_secret: config.keySecret,
        }),
        keyId: config.keyId,
    };
};

const buildPurchaseProductSnapshot = (product) => {
    return {
        title: product.title,
        slug: product.slug,
        productType: product.productType,
        includedMockTestIds: product.includedMockTestIds,
        validityDays: product.validityDays,
    };
};

const buildStudentCreateOrderResponse = (purchase, product, razorpayOrder, keyId) => {
    return {
        purchase: {
            _id: purchase._id,
            status: purchase.status,
            amountInPaise: purchase.amountInPaise,
            currency: purchase.currency,
            receipt: purchase.receipt,
        },
        product: {
            _id: product._id,
            title: product.title,
            slug: product.slug,
            productType: product.productType,
            priceInPaise: product.priceInPaise,
            priceInRupees: Number(((product.priceInPaise || 0) / 100).toFixed(2)),
            currency: product.currency || "INR",
            validityDays: product.validityDays,
        },
        razorpay: {
            keyId,
            orderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            receipt: razorpayOrder.receipt,
        },
    };
};


const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + Number(days || 0));
    return result;
};

const isNonEmptyString = (value) => {
    return typeof value === "string" && value.trim().length > 0;
};

const createRazorpaySignature = ({ orderId, paymentId, secret }) => {
    return crypto
        .createHmac("sha256", secret)
        .update(orderId + "|" + paymentId)
        .digest("hex");
};

const safeCompareStrings = (left, right) => {
    const leftBuffer = Buffer.from(String(left || ""), "utf8");
    const rightBuffer = Buffer.from(String(right || ""), "utf8");

    if (leftBuffer.length !== rightBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const verifyRazorpayPaymentSignature = ({
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
}) => {
    const config = getRazorpayConfig();

    if (!config.keySecret) {
        return {
            isValid: false,
            error: "Razorpay test keys are not configured on backend",
        };
    }

    const generatedSignature = createRazorpaySignature({
        orderId: razorpayOrderId,
        paymentId: razorpayPaymentId,
        secret: config.keySecret,
    });

    return {
        isValid: safeCompareStrings(generatedSignature, razorpaySignature),
    };
};

const buildEntitlementResponse = (entitlement) => {
    if (!entitlement) {
        return null;
    }

    return {
        _id: entitlement._id,
        entitlementType: entitlement.entitlementType,
        status: entitlement.status,
        validFrom: entitlement.validFrom,
        validUntil: entitlement.validUntil,
        mockTestIds: entitlement.mockTestIds,
    };
};

const hasActiveMockTestEntitlement = async ({ tenantId, studentId, mockTestId }) => {
    const now = new Date();

    const entitlement = await Entitlement.exists({
        tenantId,
        studentId,
        entitlementType: "mock_test_pack",
        status: "active",
        validFrom: { $lte: now },
        validUntil: { $gte: now },
        mockTestIds: mockTestId,
    });

    return Boolean(entitlement);
};

const buildStudentPaymentPackagePayload = (product) => {
    const includedMockTests = (product.includedMockTestIds || [])
        .filter((mockTest) => {
            return (
                mockTest &&
                mockTest.isActive !== false &&
                mockTest.isPublished === true &&
                mockTest.activeVersionId
            );
        })
        .map((mockTest) => {
            return {
                _id: mockTest._id,
                title: mockTest.title,
                slug: mockTest.slug,
                description: mockTest.description,
                testType: mockTest.testType,
                accessType: mockTest.accessType,
                isPublished: mockTest.isPublished,
                isActive: mockTest.isActive,
            };
        });

    return {
        _id: product._id,
        title: product.title,
        slug: product.slug,
        description: product.description,
        productType: product.productType,
        priceInPaise: product.priceInPaise,
        priceInRupees: Number(((product.priceInPaise || 0) / 100).toFixed(2)),
        currency: product.currency || "INR",
        validityDays: product.validityDays,
        includedMockTestCount: includedMockTests.length,
        includedMockTests,
        isActive: product.isActive,
    };
};

const getActivePaymentPackagesForStudent = async (req, res) => {
    try {
        const tenantId = getStudentTenantId(req);

        const products = await PaymentProduct.find({
            tenantId,
            productType: "mock_test_pack",
            isActive: true,
        })
            .populate(
                "includedMockTestIds",
                "title slug description testType accessType isPublished isActive activeVersionId"
            )
            .sort({
                sortOrder: 1,
                createdAt: -1,
            })
            .lean();

        const visibleProducts = products
            .map(buildStudentPaymentPackagePayload)
            .filter((product) => product.includedMockTestCount > 0);

        res.status(200).json({
            success: true,
            count: visibleProducts.length,
            data: visibleProducts,
        });
    } catch (error) {
        console.error("Get student payment packages error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch payment packages",
        });
    }
};


const createPaymentPackageOrderForStudent = async (req, res) => {
    try {
        const tenantId = getStudentTenantId(req);
        const studentId = req.user?._id;
        const { productId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment package ID",
            });
        }

        const product = await PaymentProduct.findOne({
            _id: productId,
            tenantId,
            productType: "mock_test_pack",
            isActive: true,
        }).lean();

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Payment package not found or inactive",
            });
        }

        if (!Number.isFinite(Number(product.priceInPaise)) || product.priceInPaise < 1) {
            return res.status(400).json({
                success: false,
                message: "Paid checkout requires package price greater than 0",
            });
        }

        if (!Array.isArray(product.includedMockTestIds) || product.includedMockTestIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Payment package has no mock tests",
            });
        }

        const razorpayClientResult = getRazorpayClient();

        if (razorpayClientResult.error) {
            return res.status(503).json({
                success: false,
                message: razorpayClientResult.error,
            });
        }

        const receipt =
            "pp_" +
            String(studentId).slice(-8) +
            "_" +
            String(product._id).slice(-8) +
            "_" +
            Date.now();

        const order = await razorpayClientResult.client.orders.create({
            amount: product.priceInPaise,
            currency: product.currency || "INR",
            receipt,
            notes: {
                tenantId,
                studentId: String(studentId),
                productId: String(product._id),
                productType: product.productType,
            },
        });

        const purchase = await Purchase.create({
            tenantId,
            studentId,
            productId: product._id,
            productSnapshot: buildPurchaseProductSnapshot(product),
            amountInPaise: product.priceInPaise,
            currency: product.currency || "INR",
            status: "created",
            provider: "razorpay",
            receipt,
            razorpayOrderId: order.id,
        });

        res.status(201).json({
            success: true,
            message: "Payment order created successfully",
            data: buildStudentCreateOrderResponse(
                purchase,
                product,
                order,
                razorpayClientResult.keyId
            ),
        });
    } catch (error) {
        console.error("Create student payment package order error:", error);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "A payment order already exists for this request",
            });
        }

        res.status(500).json({
            success: false,
            message: "Failed to create payment order",
        });
    }
};


const verifyPaymentPackagePaymentForStudent = async (req, res) => {
    try {
        const tenantId = getStudentTenantId(req);
        const studentId = req.user?._id;
        const {
            purchaseId,
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
        } = req.body || {};

        if (
            !isNonEmptyString(razorpay_order_id) ||
            !isNonEmptyString(razorpay_payment_id) ||
            !isNonEmptyString(razorpay_signature)
        ) {
            return res.status(400).json({
                success: false,
                message: "Razorpay payment ID, order ID, and signature are required",
            });
        }

        const purchaseFilter = {
            tenantId,
            studentId,
            provider: "razorpay",
            razorpayOrderId: razorpay_order_id.trim(),
        };

        if (purchaseId) {
            if (!mongoose.Types.ObjectId.isValid(purchaseId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid purchase ID",
                });
            }

            purchaseFilter._id = purchaseId;
        }

        const purchase = await Purchase.findOne(purchaseFilter);

        if (!purchase) {
            return res.status(404).json({
                success: false,
                message: "Purchase order not found for this student",
            });
        }

        if (purchase.status === "paid") {
            const existingEntitlement = await Entitlement.findOne({
                tenantId,
                studentId,
                purchaseId: purchase._id,
            });

            return res.status(200).json({
                success: true,
                message: "Payment was already verified",
                data: {
                    purchase: {
                        _id: purchase._id,
                        status: purchase.status,
                        amountInPaise: purchase.amountInPaise,
                        currency: purchase.currency,
                        razorpayOrderId: purchase.razorpayOrderId,
                        razorpayPaymentId: purchase.razorpayPaymentId,
                        paidAt: purchase.paidAt,
                    },
                    entitlement: buildEntitlementResponse(existingEntitlement),
                },
            });
        }

        if (purchase.status !== "created") {
            return res.status(409).json({
                success: false,
                message: "Purchase is not eligible for verification",
                data: {
                    purchaseStatus: purchase.status,
                },
            });
        }

        const signatureResult = verifyRazorpayPaymentSignature({
            razorpayOrderId: razorpay_order_id.trim(),
            razorpayPaymentId: razorpay_payment_id.trim(),
            razorpaySignature: razorpay_signature.trim(),
        });

        if (signatureResult.error) {
            return res.status(503).json({
                success: false,
                message: signatureResult.error,
            });
        }

        if (!signatureResult.isValid) {
            return res.status(400).json({
                success: false,
                message: "Invalid Razorpay payment signature",
            });
        }

        const razorpayClientResult = getRazorpayClient();

        if (razorpayClientResult.error) {
            return res.status(503).json({
                success: false,
                message: razorpayClientResult.error,
            });
        }

        const payment = await razorpayClientResult.client.payments.fetch(
            razorpay_payment_id.trim()
        );

        if (!payment || payment.order_id !== purchase.razorpayOrderId) {
            return res.status(400).json({
                success: false,
                message: "Razorpay payment does not belong to this order",
            });
        }

        if (Number(payment.amount) !== Number(purchase.amountInPaise)) {
            return res.status(400).json({
                success: false,
                message: "Razorpay payment amount mismatch",
            });
        }

        if ((payment.currency || "INR") !== purchase.currency) {
            return res.status(400).json({
                success: false,
                message: "Razorpay payment currency mismatch",
            });
        }

        if (payment.status !== "captured") {
            return res.status(409).json({
                success: false,
                message: "Payment is not captured yet",
                data: {
                    paymentStatus: payment.status,
                },
            });
        }

        const mockTestIds = purchase.productSnapshot?.includedMockTestIds || [];

        if (!Array.isArray(mockTestIds) || mockTestIds.length === 0) {
            return res.status(409).json({
                success: false,
                message: "Purchase has no mock tests to unlock",
            });
        }

        const paidAt = new Date();
        const validUntil = addDays(
            paidAt,
            purchase.productSnapshot?.validityDays || 365
        );

        purchase.status = "paid";
        purchase.razorpayPaymentId = razorpay_payment_id.trim();
        purchase.razorpaySignature = razorpay_signature.trim();
        purchase.paidAt = paidAt;
        purchase.failureReason = undefined;

        await purchase.save();

        const entitlement = await Entitlement.findOneAndUpdate(
            {
                tenantId,
                studentId,
                purchaseId: purchase._id,
            },
            {
                $setOnInsert: {
                    tenantId,
                    studentId,
                    productId: purchase.productId,
                    purchaseId: purchase._id,
                    entitlementType: "mock_test_pack",
                    mockTestIds,
                    validFrom: paidAt,
                    validUntil,
                    status: "active",
                },
            },
            {
                new: true,
                upsert: true,
                setDefaultsOnInsert: true,
            }
        );

        res.status(200).json({
            success: true,
            message: "Payment verified and mock test access unlocked",
            data: {
                purchase: {
                    _id: purchase._id,
                    status: purchase.status,
                    amountInPaise: purchase.amountInPaise,
                    currency: purchase.currency,
                    razorpayOrderId: purchase.razorpayOrderId,
                    razorpayPaymentId: purchase.razorpayPaymentId,
                    paidAt: purchase.paidAt,
                },
                entitlement: buildEntitlementResponse(entitlement),
            },
        });
    } catch (error) {
        console.error("Verify student payment package payment error:", error);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Payment entitlement already exists",
            });
        }

        res.status(500).json({
            success: false,
            message: "Failed to verify payment",
        });
    }
};

const getPublishedMockTestsForStudent = async (req, res) => {
    try {
        const tenantId = getStudentTenantId(req);
        const studentId = req.user?._id || req.user?.id;

        if (!studentId) {
            return res.status(401).json({
                success: false,
                message: "Not authorized",
            });
        }

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
            .populate("activeVersionId", "versionNumber publishedAt settings.maxAttempts settings.interfaceMode settings.showResultImmediately settings.solutionVisibility")
            .sort({ publishedAt: -1, createdAt: -1 });

        const mockTestIds = mockTests.map((mockTest) => mockTest._id);

        if (mockTestIds.length > 0) {
            await syncExpiredInProgressAttempts({
                tenantId,
                studentId,
                mockTestIds,
                now: new Date(),
            });
        }

        const attempts =
            mockTestIds.length > 0
                ? await TestAttempt.find({
                    tenantId,
                    studentId,
                    mockTestId: { $in: mockTestIds },
                    isActive: true,
                })
                    .select(
                        "mockTestId mockTestVersionId attemptNumber status startedAt submittedAt expiresAt review isActive createdAt"
                    )
                    .populate(
                        "mockTestVersionId",
                        "versionNumber settings.showResultImmediately examPatternSnapshot.showResultImmediately"
                    )
                    .sort({
                        attemptNumber: -1,
                        startedAt: -1,
                        createdAt: -1,
                    })
                    .lean()
                : [];

        const attemptsByMockTestId = groupAttemptsByMockTestId(attempts);
        const now = new Date();

        return res.status(200).json({
            success: true,
            count: mockTests.length,
            data: mockTests.map((mockTest) => {
                const mockTestAttempts =
                    attemptsByMockTestId.get(String(mockTest._id)) || [];

                return buildStudentMockTestListItem(
                    mockTest,
                    buildStudentAttemptSummary(mockTest, mockTestAttempts, now)
                );
            }),
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
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
            const hasPaidAccess = await hasActiveMockTestEntitlement({
                tenantId,
                studentId,
                mockTestId: mockTest._id,
            });

            if (!hasPaidAccess) {
                return res.status(403).json({
                    success: false,
                    message: "Purchase required before starting this mock test",
                });
            }
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

            const attemptDetail = await getOrCreateAttemptDetail(
                tenantId,
                existingAttempt,
                mockTestVersion
            );

            return res.status(200).json({
                success: true,
                message: "Attempt resumed successfully",
                data: buildAttemptPayload(
                    existingAttempt,
                    mockTestVersion,
                    true,
                    attemptDetail
                ),
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
        let attemptDetail = null;

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

            attemptDetail = await TestAttemptDetail.create({
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
            data: buildAttemptPayload(
                attempt,
                mockTestVersion,
                false,
                attemptDetail
            ),
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
        review: buildReviewMetadataForStudent(attempt),
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
            review: buildReviewMetadataForStudent(attempt),
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

    if (solutionVisibility === "after_submit") {
        if (!review.isDetailedReviewAvailable) {
            return {
                allowed: false,
                message: "Detailed review is not available yet",
            };
        }

        return {
            allowed: true,
            message: "Detailed review available",
        };
    }

    return {
        allowed: false,
        message: "Detailed review is not available",
    };
};

const buildReviewMetadataForStudent = (attempt, now = new Date()) => {
    const review = attempt.review || {};
    const solutionVisibility = review.solutionVisibility || "after_submit";

    let isDetailedReviewAvailable = Boolean(review.isDetailedReviewAvailable);

    if (solutionVisibility === "never") {
        isDetailedReviewAvailable = false;
    } else if (
        review.detailedReviewExpiresAt &&
        new Date(review.detailedReviewExpiresAt) <= now
    ) {
        isDetailedReviewAvailable = false;
    } else if (solutionVisibility === "after_test_end") {
        isDetailedReviewAvailable = Boolean(
            attempt.expiresAt && new Date(attempt.expiresAt) <= now
        );
    } else if (solutionVisibility === "after_submit") {
        isDetailedReviewAvailable = Boolean(review.isDetailedReviewAvailable);
    }

    return {
        isDetailedReviewAvailable,
        detailedReviewExpiresAt: review.detailedReviewExpiresAt || null,
        solutionVisibility,
        reviewRetentionDays: review.reviewRetentionDays || REVIEW_RETENTION_DAYS,
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
            review: buildReviewMetadataForStudent(attempt),
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

const isValidHistoryObjectId = (value) => {
    return /^[a-f\d]{24}$/i.test(String(value || ""));
};

const buildAttemptHistoryItem = (attempt, now = new Date()) => {
    const scoreSummary = attempt.scoreSummary || {};
    const mockTest = attempt.mockTestId || {};
    const mockTestVersion = attempt.mockTestVersionId || {};

    const getId = (value) => {
        if (!value) {
            return null;
        }

        if (value._id) {
            return String(value._id);
        }

        return String(value);
    };

    const getScoreNumber = (...keys) => {
        for (const key of keys) {
            const value = scoreSummary[key];

            if (value !== undefined && value !== null) {
                const numberValue = Number(value);

                return Number.isFinite(numberValue) ? numberValue : 0;
            }
        }

        return 0;
    };

    const isSubmitted = attempt.status === "submitted";

    const isResultVisible =
        isSubmitted &&
        mockTestVersion &&
        typeof mockTestVersion === "object" &&
        isResultImmediatelyVisible(mockTestVersion);

    return {
        attemptId: String(attempt._id),
        mockTestId: getId(attempt.mockTestId),
        mockTestVersionId: getId(attempt.mockTestVersionId),

        title:
            mockTest && typeof mockTest === "object"
                ? mockTest.title || null
                : null,
        slug:
            mockTest && typeof mockTest === "object"
                ? mockTest.slug || null
                : null,
        versionNumber:
            mockTestVersion && typeof mockTestVersion === "object"
                ? mockTestVersion.versionNumber || null
                : null,

        attemptNumber: attempt.attemptNumber,
        status: attempt.status,

        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        expiresAt: attempt.expiresAt,

        totalDurationSeconds: attempt.totalDurationSeconds,
        timeSpentSeconds: attempt.timeSpentSeconds,

        scoreSummary: {
            totalQuestions: getScoreNumber("totalQuestions"),
            attemptedQuestions: getScoreNumber(
                "attemptedQuestions",
                "answeredQuestions",
                "attempted"
            ),
            correctAnswers: getScoreNumber(
                "correctAnswers",
                "correctCount",
                "correct"
            ),
            wrongAnswers: getScoreNumber(
                "wrongAnswers",
                "wrongCount",
                "wrong"
            ),
            skippedQuestions: getScoreNumber(
                "skippedQuestions",
                "skippedCount",
                "skipped"
            ),
            markedForReviewQuestions: getScoreNumber(
                "markedForReviewQuestions",
                "markedForReviewCount",
                "markedForReview"
            ),
            score: getScoreNumber("score"),
            maxScore: getScoreNumber("maxScore", "totalMarks"),
            percentage: getScoreNumber("percentage"),
        },

        result: {
            isResultVisible,
        },

        review: buildReviewMetadataForStudent(attempt, now),
    };
};

const getMyMockTestAttempts = async (req, res) => {
    try {
        const tenantId = req.user?.tenantId;
        const studentId = req.user?._id || req.user?.id;

        if (!tenantId || !studentId) {
            return res.status(401).json({
                success: false,
                message: "Not authorized",
            });
        }

        const allowedStatuses = [
            "in_progress",
            "submitted",
            "expired",
            "abandoned",
        ];

        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(
            Math.max(parseInt(req.query.limit, 10) || 10, 1),
            50
        );
        const skip = (page - 1) * limit;

        const { status, mockTestId } = req.query;

        if (status && !allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid attempt status filter",
                allowedStatuses,
            });
        }

        if (mockTestId && !isValidHistoryObjectId(mockTestId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid mockTestId filter",
            });
        }

        await syncExpiredInProgressAttempts({
            tenantId,
            studentId,
            mockTestId: mockTestId || null,
            now: new Date(),
        });

        const filter = {
            tenantId,
            studentId,
            isActive: true,
        };

        if (status) {
            filter.status = status;
        }

        if (mockTestId) {
            filter.mockTestId = mockTestId;
        }

        const [total, attempts] = await Promise.all([
            TestAttempt.countDocuments(filter),
            TestAttempt.find(filter)
                .select(
                    [
                        "mockTestId",
                        "mockTestVersionId",
                        "attemptNumber",
                        "status",
                        "startedAt",
                        "submittedAt",
                        "expiresAt",
                        "totalDurationSeconds",
                        "timeSpentSeconds",
                        "scoreSummary",
                        "review",
                        "isActive",
                        "createdAt",
                        "updatedAt",
                    ].join(" ")
                )
                .populate("mockTestId", "title slug")
                .populate(
                    "mockTestVersionId",
                    "versionNumber publishedAt settings.showResultImmediately examPatternSnapshot.showResultImmediately"
                )
                .sort({ startedAt: -1, submittedAt: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
        ]);

        const now = new Date();

        return res.status(200).json({
            success: true,
            count: attempts.length,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            attempts: attempts.map((attempt) =>
                buildAttemptHistoryItem(attempt, now)
            ),
        });
    } catch (error) {
        console.error("Get my mock test attempts error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch mock test attempts",
        });
    }
};

module.exports = {
    getPublishedMockTestsForStudent,
    getMyMockTestAttempts,
    startMockTestAttempt,
    saveMockTestAnswer,
    submitMockTestAttempt,
    getMockTestResult,
    getMockTestReview,
  getActivePaymentPackagesForStudent,
  createPaymentPackageOrderForStudent,
  verifyPaymentPackagePaymentForStudent,
};