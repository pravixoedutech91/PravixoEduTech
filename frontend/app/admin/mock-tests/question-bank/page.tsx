"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:5000";

const ADMIN_TOKEN_STORAGE_KEY = "pravixoAdminToken";
const ADMIN_PROFILE_STORAGE_KEY = "pravixoAdminProfile";

const ALLOWED_ADMIN_ROLES = ["super_admin", "tenant_admin", "content_admin"];
const OPTION_IDS = ["A", "B", "C", "D"] as const;

type OptionId = (typeof OPTION_IDS)[number];
type QuestionSourceFilter = "all" | "original" | "pyq";
type QuestionEditorialFilter = "all" | "pending" | "approved";

type AdminProfile = {
    id?: string;
    name?: string;
    tenantId?: string;
    role?: string;
};

type MeResponse = {
    success: boolean;
    message?: string;
    data?: AdminProfile;
};

type QuestionGroupSummary = {
    _id: string;
    title?: string;
    slug?: string;
    groupType?: string;
    displayMode?: string;
    isActive?: boolean;
};

type QuestionGroupsResponse = {
    success: boolean;
    message?: string;
    count?: number;
    data?: QuestionGroupSummary[];
};

type CategorySummary = {
    _id: string;
    name?: string;
    slug?: string;
    isActive?: boolean;
};

type CategoriesResponse = {
    success: boolean;
    message?: string;
    count?: number;
    data?: CategorySummary[];
};

type QuestionOption = {
    optionId: string;
    textEn?: string;
    textHi?: string;
    imageUrl?: string;
};

type QuestionImportMetadata = {
    sourceQuestionId?: string;
    sourcePage?: number;
    sourceTopicCode?: string;
    contentStatus?: string;
    answerVerifiedBy?: string;
    languageVerifiedBy?: string;
    approvedBy?: string | null;
    approvedAt?: string | null;
};

type Question = {
    _id: string;
    externalQuestionKey?: string;
    categoryId?: CategorySummary | string | null;
    questionGroupId?: QuestionGroupSummary | string | null;
    groupQuestionOrder?: number | null;
    subject?: string;
    topic?: string;
    subTopic?: string;
    questionType?: string;
    sourceType?: string;
    questionTextEn?: string;
    questionTextHi?: string;
    questionImageUrl?: string;
    options?: QuestionOption[];
    correctOptionId?: string;
    explanationEn?: string;
    explanationHi?: string;
    marks?: number;
    negativeMarks?: number;
    difficulty?: string;
    tags?: string[];
    isActive?: boolean;
    importMetadata?: QuestionImportMetadata;
    createdAt?: string;
    updatedAt?: string;
};

type QuestionsResponse = {
    success: boolean;
    message?: string;
    count?: number;
    data?: Question[];
};

type QuestionMutationResponse = {
    success: boolean;
    message?: string;
    data?: Question;
};

type CreateQuestionOptionForm = {
    optionId: OptionId;
    textEn: string;
    textHi: string;
};

type CreateQuestionForm = {
    categoryId: string;
    questionTextEn: string;
    questionTextHi: string;
    subject: string;
    topic: string;
    subTopic: string;
    sourceType: "original" | "pyq";
    difficulty: "easy" | "medium" | "hard";
    marks: string;
    negativeMarks: string;
    correctOptionId: OptionId;
    explanationEn: string;
    explanationHi: string;
    questionGroupId: string;
    groupQuestionOrder: string;
    options: CreateQuestionOptionForm[];
};

type ToastState = {
    type: "success" | "error";
    message: string;
};

const initialCreateQuestionForm: CreateQuestionForm = {
    categoryId: "",
    questionTextEn: "",
    questionTextHi: "",
    subject: "",
    topic: "",
    subTopic: "",
    sourceType: "original",
    difficulty: "medium",
    marks: "1",
    negativeMarks: "0",
    correctOptionId: "A",
    explanationEn: "",
    explanationHi: "",
    questionGroupId: "",
    groupQuestionOrder: "",
    options: OPTION_IDS.map((optionId) => ({
        optionId,
        textEn: "",
        textHi: "",
    })),
};

const isAllowedAdminRole = (role?: string) => {
    return Boolean(role && ALLOWED_ADMIN_ROLES.includes(role));
};

const hasText = (value: string) => {
    return value.trim().length > 0;
};

const clearAdminSessionStorage = () => {
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(ADMIN_PROFILE_STORAGE_KEY);
};

const getQuestionGroupSummary = (
    questionGroupId?: QuestionGroupSummary | string | null
) => {
    if (!questionGroupId || typeof questionGroupId === "string") {
        return null;
    }

    return questionGroupId;
};

const getCategorySummary = (categoryId?: CategorySummary | string | null) => {
    if (!categoryId || typeof categoryId === "string") {
        return null;
    }

    return categoryId;
};

const getCategoryIdValue = (categoryId?: CategorySummary | string | null) => {
    if (!categoryId) {
        return "";
    }

    return typeof categoryId === "string" ? categoryId : categoryId._id;
};

type BulkImportCsvParseResult = {
    headers: string[];
    rows: string[][];
};

const MAX_BULK_IMPORT_CSV_BYTES = 10 * 1024 * 1024;
const BULK_IMPORT_PREVIEW_LIMIT = 5;

const parseBulkImportCsv = (input: string): BulkImportCsvParseResult => {
    const text =
        input.length > 0 && input.charCodeAt(0) === 0xfeff
            ? input.slice(1)
            : input;

    const records: string[][] = [];
    let row: string[] = [];
    let field = "";
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];

        if (inQuotes) {
            if (character === '"') {
                if (text[index + 1] === '"') {
                    field += '"';
                    index += 1;
                } else {
                    inQuotes = false;
                }
            } else {
                field += character;
            }

            continue;
        }

        if (character === '"') {
            if (field.length === 0) {
                inQuotes = true;
            } else {
                field += character;
            }

            continue;
        }

        if (character === ",") {
            row.push(field);
            field = "";
            continue;
        }

        if (character === "\r" || character === "\n") {
            row.push(field);
            field = "";
            records.push(row);
            row = [];

            if (character === "\r" && text[index + 1] === "\n") {
                index += 1;
            }

            continue;
        }

        field += character;
    }

    if (inQuotes) {
        throw new Error("CSV contains an unclosed quoted field.");
    }

    if (field.length > 0 || row.length > 0) {
        row.push(field);
        records.push(row);
    }

    const nonEmptyRecords = records.filter((record) =>
        record.some((value) => value.trim().length > 0)
    );

    if (nonEmptyRecords.length === 0) {
        return {
            headers: [],
            rows: [],
        };
    }

    const [headerRow, ...dataRows] = nonEmptyRecords;

    return {
        headers: headerRow.map((header, index) => {
            const value =
                index === 0 ? header.replace(/^\uFEFF/, "") : header;

            return value.trim();
        }),
        rows: dataRows,
    };
};

const getBulkImportCsvValue = (
    headers: string[],
    row: string[],
    headerName: string
) => {
    const columnIndex = headers.indexOf(headerName);

    if (columnIndex < 0) {
        return "";
    }

    return row[columnIndex] || "";
};

const formatBulkImportFileSize = (bytes: number) => {
    if (bytes < 1024) {
        return bytes + " B";
    }

    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(1) + " KB";
    }

    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
};
type BulkImportValidationSeverity = "error" | "warning";

type BulkImportValidationIssue = {
    severity: BulkImportValidationSeverity;
    rowNumber: number | null;
    externalQuestionKey: string;
    field: string;
    message: string;
};

type BulkImportValidationResult = {
    errorCount: number;
    warningCount: number;
    validRowCount: number;
    invalidRowCount: number;
    issues: BulkImportValidationIssue[];
    missingHeaders: string[];
    duplicateHeaders: string[];
};

type BulkImportDryRunSummary = {
    rowsReceived: number;
    resolvedRows: number;
    blockedRows: number;
    uniqueCategoryKeys: number;
    resolvedCategoryKeys: number;
    unresolvedCategoryKeys: number;
};

type BulkImportDryRunIssue = {
    field?: string;
    message?: string;
};

type BulkImportDryRunCategory = {
    _id: string;
    name?: string;
    slug: string;
    isActive?: boolean;
};

type BulkImportDryRunRow = {
    rowNumber: number;
    externalQuestionKey: string;
    categoryExternalKey: string;
    status: "resolved" | "blocked";
    category: BulkImportDryRunCategory | null;
    issues?: BulkImportDryRunIssue[];
};

type BulkImportDryRunResponse = {
    success: boolean;
    message?: string;
    dryRun?: boolean;
    writesPerformed?: number;
    targetTenantId?: string;
    summary?: BulkImportDryRunSummary;
    data?: BulkImportDryRunRow[];
};

const BULK_IMPORT_REQUIRED_HEADERS = [
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
    "optionAEn",
    "optionBEn",
    "optionCEn",
    "optionDEn",
    "optionAHi",
    "optionBHi",
    "optionCHi",
    "optionDHi",
    "correctOptionId",
    "explanationEn",
    "explanationHi",
    "marks",
    "negativeMarks",
    "difficulty",
    "tagsCsv",
    "pyqExamName",
    "pyqYear",
    "pyqShift",
    "pyqPaperCode",
    "isActive",
    "contentStatus",
    "answerVerifiedBy",
    "languageVerifiedBy",
] as const;

const hasBulkImportText = (value: string) => value.trim().length > 0;

const isNonNegativeBulkImportNumber = (value: string) => {
    if (!hasBulkImportText(value)) {
        return false;
    }

    const parsed = Number(value);

    return Number.isFinite(parsed) && parsed >= 0;
};

const validateBulkImportCsv = (
    headers: string[],
    rows: string[][]
): BulkImportValidationResult => {
    const issues: BulkImportValidationIssue[] = [];
    const invalidRowIndexes = new Set<number>();

    const addHeaderError = (field: string, message: string) => {
        issues.push({
            severity: "error",
            rowNumber: null,
            externalQuestionKey: "",
            field,
            message,
        });
    };

    const addRowIssue = (
        severity: BulkImportValidationSeverity,
        rowIndex: number,
        externalQuestionKey: string,
        field: string,
        message: string
    ) => {
        issues.push({
            severity,
            rowNumber: rowIndex + 1,
            externalQuestionKey,
            field,
            message,
        });

        if (severity === "error") {
            invalidRowIndexes.add(rowIndex);
        }
    };

    const missingHeaders = BULK_IMPORT_REQUIRED_HEADERS.filter(
        (header) => !headers.includes(header)
    );

    missingHeaders.forEach((header) => {
        addHeaderError(header, `Required CSV header "${header}" is missing.`);
    });

    const normalizedHeaderIndexes = new Map<string, number>();
    const duplicateHeaders: string[] = [];

    headers.forEach((header, index) => {
        const normalizedHeader = header.trim().toLowerCase();
        const existingIndex = normalizedHeaderIndexes.get(normalizedHeader);

        if (existingIndex !== undefined) {
            duplicateHeaders.push(header);
            return;
        }

        normalizedHeaderIndexes.set(normalizedHeader, index);
    });

    duplicateHeaders.forEach((header) => {
        addHeaderError(
            header,
            `CSV contains duplicate header "${header}".`
        );
    });

    if (missingHeaders.length > 0 || duplicateHeaders.length > 0) {
        return {
            errorCount: issues.filter(
                (issue) => issue.severity === "error"
            ).length,
            warningCount: 0,
            validRowCount: 0,
            invalidRowCount: rows.length,
            issues,
            missingHeaders: [...missingHeaders],
            duplicateHeaders,
        };
    }

    const seenExternalQuestionKeys = new Map<string, number>();

    rows.forEach((row, rowIndex) => {
        const externalQuestionKey = getBulkImportCsvValue(
            headers,
            row,
            "externalQuestionKey"
        ).trim();

        if (row.length !== headers.length) {
            addRowIssue(
                "error",
                rowIndex,
                externalQuestionKey,
                "row",
                `Parsed row has ${row.length} columns but the header has ${headers.length}.`
            );
        }

        if (!externalQuestionKey) {
            addRowIssue(
                "error",
                rowIndex,
                "",
                "externalQuestionKey",
                "External question key is required."
            );
        } else {
            const normalizedExternalKey =
                externalQuestionKey.toLowerCase();

            const existingRowIndex =
                seenExternalQuestionKeys.get(normalizedExternalKey);

            if (existingRowIndex !== undefined) {
                const firstExternalKey = getBulkImportCsvValue(
                    headers,
                    rows[existingRowIndex],
                    "externalQuestionKey"
                ).trim();

                addRowIssue(
                    "error",
                    existingRowIndex,
                    firstExternalKey,
                    "externalQuestionKey",
                    `External question key "${externalQuestionKey}" is duplicated.`
                );

                addRowIssue(
                    "error",
                    rowIndex,
                    externalQuestionKey,
                    "externalQuestionKey",
                    `External question key "${externalQuestionKey}" is duplicated.`
                );
            } else {
                seenExternalQuestionKeys.set(
                    normalizedExternalKey,
                    rowIndex
                );
            }
        }

        const categoryExternalKey = getBulkImportCsvValue(
            headers,
            row,
            "categoryExternalKey"
        ).trim();

        if (!categoryExternalKey) {
            addRowIssue(
                "error",
                rowIndex,
                externalQuestionKey,
                "categoryExternalKey",
                "Category external key is required."
            );
        }

        const questionType = getBulkImportCsvValue(
            headers,
            row,
            "questionType"
        )
            .trim()
            .toLowerCase();

        if (questionType !== "mcq") {
            addRowIssue(
                "error",
                rowIndex,
                externalQuestionKey,
                "questionType",
                'Question type must be "mcq".'
            );
        }

        const sourceType = getBulkImportCsvValue(
            headers,
            row,
            "sourceType"
        )
            .trim()
            .toLowerCase();

        if (!["original", "pyq"].includes(sourceType)) {
            addRowIssue(
                "error",
                rowIndex,
                externalQuestionKey,
                "sourceType",
                'Source type must be "original" or "pyq".'
            );
        }

        const questionTextEn = getBulkImportCsvValue(
            headers,
            row,
            "questionTextEn"
        );

        const questionTextHi = getBulkImportCsvValue(
            headers,
            row,
            "questionTextHi"
        );

        if (!hasBulkImportText(questionTextEn)) {
            addRowIssue(
                "error",
                rowIndex,
                externalQuestionKey,
                "questionTextEn",
                "English question text is required for this bilingual import contract."
            );
        }

        if (!hasBulkImportText(questionTextHi)) {
            addRowIssue(
                "error",
                rowIndex,
                externalQuestionKey,
                "questionTextHi",
                "Hindi question text is required for this bilingual import contract."
            );
        }

        const bilingualOptionFields = [
            "optionAEn",
            "optionBEn",
            "optionCEn",
            "optionDEn",
            "optionAHi",
            "optionBHi",
            "optionCHi",
            "optionDHi",
        ];

        bilingualOptionFields.forEach((field) => {
            const value = getBulkImportCsvValue(
                headers,
                row,
                field
            );

            if (!hasBulkImportText(value)) {
                addRowIssue(
                    "error",
                    rowIndex,
                    externalQuestionKey,
                    field,
                    `${field} is required for the four-option bilingual MCQ contract.`
                );
            }
        });

        const correctOptionId = getBulkImportCsvValue(
            headers,
            row,
            "correctOptionId"
        )
            .trim()
            .toUpperCase();

        if (!["A", "B", "C", "D"].includes(correctOptionId)) {
            addRowIssue(
                "error",
                rowIndex,
                externalQuestionKey,
                "correctOptionId",
                "Correct option must be A, B, C or D."
            );
        }

        const marks = getBulkImportCsvValue(
            headers,
            row,
            "marks"
        );

        if (!isNonNegativeBulkImportNumber(marks)) {
            addRowIssue(
                "error",
                rowIndex,
                externalQuestionKey,
                "marks",
                "Marks must be a valid non-negative number."
            );
        }

        const negativeMarks = getBulkImportCsvValue(
            headers,
            row,
            "negativeMarks"
        );

        if (!isNonNegativeBulkImportNumber(negativeMarks)) {
            addRowIssue(
                "error",
                rowIndex,
                externalQuestionKey,
                "negativeMarks",
                "Negative marks must be a valid non-negative number."
            );
        }

        const difficulty = getBulkImportCsvValue(
            headers,
            row,
            "difficulty"
        )
            .trim()
            .toLowerCase();

        if (!["easy", "medium", "hard"].includes(difficulty)) {
            addRowIssue(
                "error",
                rowIndex,
                externalQuestionKey,
                "difficulty",
                'Difficulty must be "easy", "medium" or "hard".'
            );
        }

        const isActive = getBulkImportCsvValue(
            headers,
            row,
            "isActive"
        )
            .trim()
            .toLowerCase();

        if (!["true", "false"].includes(isActive)) {
            addRowIssue(
                "error",
                rowIndex,
                externalQuestionKey,
                "isActive",
                'isActive must be "true" or "false".'
            );
        }

        const questionGroupExternalKey = getBulkImportCsvValue(
            headers,
            row,
            "questionGroupExternalKey"
        ).trim();

        const groupQuestionOrder = getBulkImportCsvValue(
            headers,
            row,
            "groupQuestionOrder"
        ).trim();

        if (questionGroupExternalKey) {
            const parsedGroupQuestionOrder = Number(groupQuestionOrder);

            if (
                !Number.isInteger(parsedGroupQuestionOrder) ||
                parsedGroupQuestionOrder < 1
            ) {
                addRowIssue(
                    "error",
                    rowIndex,
                    externalQuestionKey,
                    "groupQuestionOrder",
                    "Grouped questions require a positive integer groupQuestionOrder."
                );
            }
        } else if (groupQuestionOrder) {
            addRowIssue(
                "error",
                rowIndex,
                externalQuestionKey,
                "groupQuestionOrder",
                "groupQuestionOrder cannot be set without questionGroupExternalKey."
            );
        }

        if (sourceType === "pyq") {
            const requiredPyqFields = [
                "pyqExamName",
                "pyqYear",
                "pyqShift",
                "pyqPaperCode",
            ];

            const missingPyqFields = requiredPyqFields.filter(
                (field) =>
                    !hasBulkImportText(
                        getBulkImportCsvValue(headers, row, field)
                    )
            );

            if (missingPyqFields.length > 0) {
                addRowIssue(
                    "error",
                    rowIndex,
                    externalQuestionKey,
                    "pyqDetails",
                    `PYQ provenance is incomplete: ${missingPyqFields.join(", ")}.`
                );
            }
        }

        const contentStatus = getBulkImportCsvValue(
            headers,
            row,
            "contentStatus"
        )
            .trim()
            .toLowerCase();

        const answerVerifiedBy = getBulkImportCsvValue(
            headers,
            row,
            "answerVerifiedBy"
        )
            .trim()
            .toLowerCase();

        const languageVerifiedBy = getBulkImportCsvValue(
            headers,
            row,
            "languageVerifiedBy"
        )
            .trim()
            .toLowerCase();

        const finalHumanReviewPending =
            contentStatus === "editorial_review_required" ||
            answerVerifiedBy.includes("final human") ||
            answerVerifiedBy.includes("sign-off required") ||
            languageVerifiedBy.includes("final human") ||
            languageVerifiedBy.includes("sign-off required");

        if (finalHumanReviewPending) {
            addRowIssue(
                "warning",
                rowIndex,
                externalQuestionKey,
                "contentStatus",
                "Final human editorial/answer/bilingual sign-off is still pending."
            );
        } else if (!contentStatus) {
            addRowIssue(
                "warning",
                rowIndex,
                externalQuestionKey,
                "contentStatus",
                "Content status is blank; editorial readiness is unknown."
            );
        }

        const subject = getBulkImportCsvValue(
            headers,
            row,
            "subject"
        );

        const topic = getBulkImportCsvValue(
            headers,
            row,
            "topic"
        );

        if (!hasBulkImportText(subject)) {
            addRowIssue(
                "warning",
                rowIndex,
                externalQuestionKey,
                "subject",
                "Subject is blank."
            );
        }

        if (!hasBulkImportText(topic)) {
            addRowIssue(
                "warning",
                rowIndex,
                externalQuestionKey,
                "topic",
                "Topic is blank."
            );
        }
    });

    const errorCount = issues.filter(
        (issue) => issue.severity === "error"
    ).length;

    const warningCount = issues.filter(
        (issue) => issue.severity === "warning"
    ).length;

    return {
        errorCount,
        warningCount,
        validRowCount: rows.length - invalidRowIndexes.size,
        invalidRowCount: invalidRowIndexes.size,
        issues,
        missingHeaders: [],
        duplicateHeaders: [],
    };
};
export default function AdminQuestionBankPage() {
    const [isReady, setIsReady] = useState(false);
    const [isAllowed, setIsAllowed] = useState(false);
    const [adminRole, setAdminRole] = useState("");
    const [editorialReviewQuestionId, setEditorialReviewQuestionId] =
        useState("");
    const [editorialAnswerAttested, setEditorialAnswerAttested] =
        useState(false);
    const [editorialLanguageAttested, setEditorialLanguageAttested] =
        useState(false);
    const [approvingQuestionId, setApprovingQuestionId] = useState("");
    const editorialApprovalInFlightRef = useRef(false);
    const [message, setMessage] = useState("");
    const [questions, setQuestions] = useState<Question[]>([]);
    const [categories, setCategories] = useState<CategorySummary[]>([]);
    const [questionGroups, setQuestionGroups] = useState<QuestionGroupSummary[]>(
        []
    );
    const [isQuestionsLoading, setIsQuestionsLoading] = useState(false);
    const [isCategoriesLoading, setIsCategoriesLoading] = useState(false);
    const [isQuestionGroupsLoading, setIsQuestionGroupsLoading] =
        useState(false);
    const [showInactiveQuestions, setShowInactiveQuestions] = useState(false);
    const [questionCategoryFilter, setQuestionCategoryFilter] = useState("");
    const [questionSourceFilter, setQuestionSourceFilter] =
        useState<QuestionSourceFilter>("all");
    const [questionEditorialFilter, setQuestionEditorialFilter] =
        useState<QuestionEditorialFilter>("all");
    const [bulkImportFileName, setBulkImportFileName] = useState("");
    const [bulkImportFileSize, setBulkImportFileSize] = useState(0);
    const [bulkImportHeaders, setBulkImportHeaders] = useState<string[]>([]);
    const [bulkImportRows, setBulkImportRows] = useState<string[][]>([]);
    const [bulkImportParseError, setBulkImportParseError] = useState("");
    const [isBulkImportParsing, setIsBulkImportParsing] = useState(false);
    const [showBulkImportPreview, setShowBulkImportPreview] = useState(false);
    const [
        bulkImportValidation,
        setBulkImportValidation,
    ] = useState<BulkImportValidationResult | null>(null);
    const [bulkImportDryRun, setBulkImportDryRun] =
        useState<BulkImportDryRunResponse | null>(null);
    const [bulkImportDryRunError, setBulkImportDryRunError] = useState("");
    const [isBulkImportDryRunning, setIsBulkImportDryRunning] = useState(false);
    const [disablingQuestionId, setDisablingQuestionId] = useState("");
    const [questionsError, setQuestionsError] = useState("");
    const [categoriesError, setCategoriesError] = useState("");
    const [questionGroupsError, setQuestionGroupsError] = useState("");
    const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
    const [isCreateSaving, setIsCreateSaving] = useState(false);
    const [editingQuestionId, setEditingQuestionId] = useState("");
    const [createQuestionForm, setCreateQuestionForm] =
        useState<CreateQuestionForm>(initialCreateQuestionForm);
    const [toast, setToast] = useState<ToastState | null>(null);

    const isImportedQuestion = (question: Question) =>
        Boolean(question.externalQuestionKey?.trim());

    const hasPendingHumanSignoffMarker = (value?: string) => {
        const normalizedValue = (value || "").trim().toLowerCase();

        return (
            normalizedValue.includes("final human") ||
            normalizedValue.includes("sign-off required")
        );
    };

    const isQuestionEditoriallyApproved = (question: Question) => {
        const metadata = question.importMetadata;
        const answerVerifiedBy = metadata?.answerVerifiedBy?.trim() || "";
        const languageVerifiedBy = metadata?.languageVerifiedBy?.trim() || "";
        const approvedAt = metadata?.approvedAt || "";
        const approvedAtDate = new Date(approvedAt);

        return Boolean(
            isImportedQuestion(question) &&
                metadata?.contentStatus?.trim().toLowerCase() === "approved" &&
                answerVerifiedBy &&
                languageVerifiedBy &&
                metadata?.approvedBy &&
                approvedAt &&
                !Number.isNaN(approvedAtDate.getTime()) &&
                !hasPendingHumanSignoffMarker(answerVerifiedBy) &&
                !hasPendingHumanSignoffMarker(languageVerifiedBy)
        );
    };

    const importedQuestionCount = questions.filter(isImportedQuestion).length;
    const approvedEditorialCount = questions.filter(
        isQuestionEditoriallyApproved
    ).length;
    const pendingEditorialCount =
        importedQuestionCount - approvedEditorialCount;

    const filteredQuestions = questions.filter((question) => {
        if (questionEditorialFilter === "all") {
            return true;
        }

        if (!isImportedQuestion(question)) {
            return false;
        }

        const editoriallyApproved =
            isQuestionEditoriallyApproved(question);

        return questionEditorialFilter === "approved"
            ? editoriallyApproved
            : !editoriallyApproved;
    });

    const compareEditorialQuestionKeys = (
        left: Question,
        right: Question
    ) => {
        const leftKey = left.externalQuestionKey?.trim() || "";
        const rightKey = right.externalQuestionKey?.trim() || "";

        const keyComparison = leftKey.localeCompare(
            rightKey,
            undefined,
            {
                numeric: true,
                sensitivity: "base",
            }
        );

        return keyComparison !== 0
            ? keyComparison
            : left._id.localeCompare(right._id);
    };

    const editorialQueueQuestions =
        questionEditorialFilter === "pending"
            ? [...filteredQuestions].sort(compareEditorialQuestionKeys)
            : filteredQuestions;

    const formatEditorialTimestamp = (value?: string | null) => {
        if (!value) return "Not available";

        const parsed = new Date(value);

        if (Number.isNaN(parsed.getTime())) {
            return "Not available";
        }

        return parsed.toLocaleString();
    };

    const openEditorialReview = (questionId: string) => {
        setEditorialAnswerAttested(false);
        setEditorialLanguageAttested(false);
        setEditorialReviewQuestionId(questionId);

        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                document
                    .getElementById(`editorial-review-${questionId}`)
                    ?.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                    });
            });
        });
    };

    const closeEditorialReview = () => {
        setEditorialReviewQuestionId("");
        setEditorialAnswerAttested(false);
        setEditorialLanguageAttested(false);
    };

    const handleReviewNextPending = () => {
        if (
            questionEditorialFilter !== "pending" ||
            (adminRole !== "super_admin" && adminRole !== "tenant_admin")
        ) {
            return;
        }

        const nextPendingQuestion = editorialQueueQuestions[0];

        if (!nextPendingQuestion) {
            return;
        }

        openEditorialReview(nextPendingQuestion._id);
    };

    const showToast = (nextToast: ToastState) => {
        setToast(nextToast);

        window.setTimeout(() => {
            setToast(null);
        }, 3000);
    };

    const loadQuestions = async (
        savedToken: string,
        includeInactive = showInactiveQuestions,
        categoryId = questionCategoryFilter,
        sourceType = questionSourceFilter
    ) => {
        setIsQuestionsLoading(true);
        setQuestionsError("");

        try {
            const params = new URLSearchParams();

            if (!includeInactive) {
                params.set("isActive", "true");
            }

            if (categoryId) {
                params.set("categoryId", categoryId);
            }

            if (sourceType !== "all") {
                params.set("sourceType", sourceType);
            }

            const queryString = params.toString();
            const questionsUrl =
                API_BASE_URL +
                "/api/questions" +
                (queryString ? "?" + queryString : "");

            const response = await fetch(questionsUrl, {
                headers: {
                    Authorization: "Bearer " + savedToken,
                },
            });

            const result = (await response.json()) as QuestionsResponse;

            if (response.status === 401 || response.status === 403) {
                clearAdminSessionStorage();
                setIsAllowed(false);
                setAdminRole("");
                setMessage(
                    result.message ||
                        "Your admin session has expired. Please login again."
                );
                return;
            }

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to load questions.");
            }

            setQuestions(result.data || []);
        } catch (error) {
            setQuestionsError(
                error instanceof Error
                    ? error.message
                    : "Unable to load questions."
            );
        } finally {
            setIsQuestionsLoading(false);
        }
    };

    const loadCategories = async (savedToken: string) => {
        setIsCategoriesLoading(true);
        setCategoriesError("");

        try {
            const response = await fetch(API_BASE_URL + "/api/categories", {
                headers: {
                    Authorization: "Bearer " + savedToken,
                },
            });

            const result = (await response.json()) as CategoriesResponse;

            if (response.status === 401 || response.status === 403) {
                clearAdminSessionStorage();
                setIsAllowed(false);
                setAdminRole("");
                setMessage(
                    result.message ||
                        "Your admin session has expired. Please login again."
                );
                return;
            }

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to load categories.");
            }

            setCategories(Array.isArray(result.data) ? result.data : []);
        } catch (error) {
            setCategoriesError(
                error instanceof Error
                    ? error.message
                    : "Unable to load categories."
            );
        } finally {
            setIsCategoriesLoading(false);
        }
    };

    const loadQuestionGroups = async (savedToken: string) => {
        setIsQuestionGroupsLoading(true);
        setQuestionGroupsError("");

        try {
            const response = await fetch(API_BASE_URL + "/api/question-groups", {
                headers: {
                    Authorization: "Bearer " + savedToken,
                },
            });

            const result = (await response.json()) as QuestionGroupsResponse;

            if (response.status === 401 || response.status === 403) {
                clearAdminSessionStorage();
                setIsAllowed(false);
                setAdminRole("");
                setMessage(
                    result.message ||
                        "Your admin session has expired. Please login again."
                );
                return;
            }

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Unable to load question groups."
                );
            }

            setQuestionGroups(result.data || []);
        } catch (error) {
            setQuestionGroupsError(
                error instanceof Error
                    ? error.message
                    : "Unable to load question groups."
            );
        } finally {
            setIsQuestionGroupsLoading(false);
        }
    };

    const updateCreateQuestionForm = (
        field: keyof Omit<CreateQuestionForm, "options">,
        value: string
    ) => {
        setCreateQuestionForm((current) => ({
            ...current,
            [field]: value,
        }));
    };

    const updateCreateOption = (
        optionId: OptionId,
        field: "textEn" | "textHi",
        value: string
    ) => {
        setCreateQuestionForm((current) => ({
            ...current,
            options: current.options.map((option) =>
                option.optionId === optionId
                    ? {
                          ...option,
                          [field]: value,
                      }
                    : option
            ),
        }));
    };

    const resetCreateQuestionForm = () => {
        setCreateQuestionForm(initialCreateQuestionForm);
    };

    const getEditableOptionValue = (
        question: Question,
        optionId: OptionId,
        field: "textEn" | "textHi"
    ) => {
        return (
            question.options?.find((option) => option.optionId === optionId)?.[
                field
            ] || ""
        );
    };

    const startEditQuestion = (question: Question) => {
        const group = getQuestionGroupSummary(question.questionGroupId);

        setEditingQuestionId(question._id);
        setCreateQuestionForm({
            categoryId: getCategoryIdValue(question.categoryId),
            questionTextEn: question.questionTextEn || "",
            questionTextHi: question.questionTextHi || "",
            subject: question.subject || "",
            topic: question.topic || "",
            subTopic: question.subTopic || "",
            sourceType:
                question.sourceType === "pyq" ? "pyq" : "original",
            difficulty:
                question.difficulty === "easy" ||
                question.difficulty === "hard"
                    ? question.difficulty
                    : "medium",
            marks: String(question.marks ?? 1),
            negativeMarks: String(question.negativeMarks ?? 0),
            correctOptionId: OPTION_IDS.includes(
                question.correctOptionId as OptionId
            )
                ? (question.correctOptionId as OptionId)
                : "A",
            explanationEn: question.explanationEn || "",
            explanationHi: question.explanationHi || "",
            questionGroupId: group?._id || "",
            groupQuestionOrder: question.groupQuestionOrder
                ? String(question.groupQuestionOrder)
                : "",
            options: OPTION_IDS.map((optionId) => ({
                optionId,
                textEn: getEditableOptionValue(question, optionId, "textEn"),
                textHi: getEditableOptionValue(question, optionId, "textHi"),
            })),
        });
        setIsCreateFormOpen(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const cancelEditQuestion = () => {
        setEditingQuestionId("");
        resetCreateQuestionForm();
        setIsCreateFormOpen(false);
    };

    const buildCreateQuestionPayload = () => {
        const filledOptions = createQuestionForm.options
            .filter((option) => hasText(option.textEn) || hasText(option.textHi))
            .map((option) => ({
                optionId: option.optionId,
                textEn: option.textEn.trim(),
                textHi: option.textHi.trim(),
                imageUrl: "",
            }));

        const marks = Number(createQuestionForm.marks);
        const negativeMarks = Number(createQuestionForm.negativeMarks);

        return {
            categoryId: createQuestionForm.categoryId || null,
            questionType: "mcq",
            sourceType: createQuestionForm.sourceType,
            questionTextEn: createQuestionForm.questionTextEn.trim(),
            questionTextHi: createQuestionForm.questionTextHi.trim(),
            questionImageUrl: "",
            subject: createQuestionForm.subject.trim(),
            topic: createQuestionForm.topic.trim(),
            subTopic: createQuestionForm.subTopic.trim(),
            difficulty: createQuestionForm.difficulty,
            marks,
            negativeMarks,
            options: filledOptions,
            correctOptionId: createQuestionForm.correctOptionId,
            explanationEn: createQuestionForm.explanationEn.trim(),
            explanationHi: createQuestionForm.explanationHi.trim(),
            questionGroupId: createQuestionForm.questionGroupId || null,
            groupQuestionOrder: createQuestionForm.questionGroupId
                ? Number(createQuestionForm.groupQuestionOrder)
                : null,
        };
    };

    const validateCreateQuestionForm = () => {
        if (
            !hasText(createQuestionForm.questionTextEn) &&
            !hasText(createQuestionForm.questionTextHi)
        ) {
            return "Question text is required.";
        }

        const marks = Number(createQuestionForm.marks);
        const negativeMarks = Number(createQuestionForm.negativeMarks);

        if (!Number.isFinite(marks) || marks < 0) {
            return "Marks must be zero or more.";
        }

        if (!Number.isFinite(negativeMarks) || negativeMarks < 0) {
            return "Negative marks must be zero or more.";
        }

        const filledOptions = createQuestionForm.options.filter(
            (option) => hasText(option.textEn) || hasText(option.textHi)
        );

        if (filledOptions.length < 2) {
            return "At least two options are required.";
        }

        if (
            !filledOptions.some(
                (option) =>
                    option.optionId === createQuestionForm.correctOptionId
            )
        ) {
            return "Correct option must have option text.";
        }

        if (createQuestionForm.questionGroupId) {
            const order = Number(createQuestionForm.groupQuestionOrder);

            if (!Number.isInteger(order) || order < 1) {
                return "Group question order must be a positive integer.";
            }
        }

        return "";
    };

    const handleCreateQuestion = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const validationError = validateCreateQuestionForm();

        if (validationError) {
            showToast({
                type: "error",
                message: validationError,
            });
            return;
        }

        const savedToken =
            window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "";

        if (!savedToken) {
            clearAdminSessionStorage();
            setIsAllowed(false);
            setAdminRole("");
            setMessage("Please login with an admin account.");
            return;
        }

        setIsCreateSaving(true);

        try {
            const response = await fetch(API_BASE_URL + "/api/questions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer " + savedToken,
                },
                body: JSON.stringify(buildCreateQuestionPayload()),
            });

            const result = (await response.json()) as QuestionMutationResponse;

            if (response.status === 401 || response.status === 403) {
                clearAdminSessionStorage();
                setIsAllowed(false);
                setAdminRole("");
                setMessage(
                    result.message ||
                        "Your admin session has expired. Please login again."
                );
                return;
            }

            if (!response.ok || !result.success || !result.data?._id) {
                throw new Error(result.message || "Unable to create question.");
            }

            const createdQuestion = result.data;

            setQuestions((current) => [
                createdQuestion,
                ...current.filter((question) => question._id !== createdQuestion._id),
            ]);

            resetCreateQuestionForm();
            setIsCreateFormOpen(false);
            showToast({
                type: "success",
                message: "Question created successfully.",
            });
        } catch (error) {
            showToast({
                type: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "Unable to create question.",
            });
        } finally {
            setIsCreateSaving(false);
        }
    };

    const handleUpdateQuestion = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!editingQuestionId) {
            return;
        }

        const validationError = validateCreateQuestionForm();

        if (validationError) {
            showToast({
                type: "error",
                message: validationError,
            });
            return;
        }

        const savedToken =
            window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "";

        if (!savedToken) {
            clearAdminSessionStorage();
            setIsAllowed(false);
            setAdminRole("");
            setMessage("Please login with an admin account.");
            return;
        }

        setIsCreateSaving(true);

        try {
            const response = await fetch(
                API_BASE_URL + "/api/questions/" + editingQuestionId,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: "Bearer " + savedToken,
                    },
                    body: JSON.stringify(buildCreateQuestionPayload()),
                }
            );

            const result = (await response.json()) as QuestionMutationResponse;

            if (response.status === 401 || response.status === 403) {
                clearAdminSessionStorage();
                setIsAllowed(false);
                setAdminRole("");
                setMessage(
                    result.message ||
                        "Your admin session has expired. Please login again."
                );
                return;
            }

            if (!response.ok || !result.success || !result.data?._id) {
                throw new Error(result.message || "Unable to update question.");
            }

            const updatedQuestion = result.data;

            setQuestions((current) =>
                current.map((question) =>
                    question._id === updatedQuestion._id
                        ? updatedQuestion
                        : question
                )
            );

            setEditingQuestionId("");
            resetCreateQuestionForm();
            setIsCreateFormOpen(false);
            showToast({
                type: "success",
                message: "Question updated successfully.",
            });
        } catch (error) {
            showToast({
                type: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "Unable to update question.",
            });
        } finally {
            setIsCreateSaving(false);
        }
    };

    const resetBulkImportLocalPreview = () => {
        setBulkImportDryRun(null);
        setBulkImportDryRunError("");
        setIsBulkImportDryRunning(false);
        setBulkImportHeaders([]);
        setBulkImportRows([]);
        setBulkImportParseError("");
        setShowBulkImportPreview(false);
        setBulkImportValidation(null);
    };

    const handleBulkImportFileChange = async (file: File | null) => {
        resetBulkImportLocalPreview();
        setBulkImportFileName("");
        setBulkImportFileSize(0);

        if (!file) {
            return;
        }

        setBulkImportFileName(file.name);
        setBulkImportFileSize(file.size);

        const isCsvFile =
            file.name.toLowerCase().endsWith(".csv") ||
            file.type === "text/csv" ||
            file.type === "application/vnd.ms-excel" ||
            file.type === "";

        if (!isCsvFile) {
            setBulkImportParseError("Choose a CSV file.");
            return;
        }

        if (file.size === 0) {
            setBulkImportParseError("The selected CSV file is empty.");
            return;
        }

        if (file.size > MAX_BULK_IMPORT_CSV_BYTES) {
            setBulkImportParseError(
                "CSV is larger than the 10 MB local-preview safety limit."
            );
            return;
        }

        setIsBulkImportParsing(true);

        try {
            const fileText = await file.text();
            const parsed = parseBulkImportCsv(fileText);

            if (parsed.headers.length === 0) {
                throw new Error("CSV header row was not found.");
            }

            if (parsed.rows.length === 0) {
                throw new Error("CSV contains a header but no data rows.");
            }

            setBulkImportHeaders(parsed.headers);
            setBulkImportRows(parsed.rows);
        } catch (error) {
            setBulkImportHeaders([]);
            setBulkImportRows([]);
            setShowBulkImportPreview(false);
            setBulkImportParseError(
                error instanceof Error
                    ? error.message
                    : "Unable to parse the selected CSV file."
            );
        } finally {
            setIsBulkImportParsing(false);
        }
    };
    const handleValidateBulkImportCsv = () => {
        setBulkImportDryRun(null);
        setBulkImportDryRunError("");
        if (
            bulkImportRows.length === 0 ||
            bulkImportHeaders.length === 0 ||
            bulkImportParseError
        ) {
            setBulkImportValidation(null);
            return;
        }

        setBulkImportValidation(
            validateBulkImportCsv(
                bulkImportHeaders,
                bulkImportRows
            )
        );
    };
    const handleBulkImportBackendDryRun = async () => {
        setBulkImportDryRun(null);
        setBulkImportDryRunError("");

        if (
            !bulkImportValidation ||
            bulkImportValidation.errorCount > 0 ||
            bulkImportRows.length === 0 ||
            bulkImportHeaders.length === 0 ||
            bulkImportParseError
        ) {
            setBulkImportDryRunError(
                "Run local validation successfully before the backend dry run."
            );
            return;
        }

        const savedToken =
            window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "";

        if (!savedToken) {
            clearAdminSessionStorage();
            setIsAllowed(false);
            setAdminRole("");
            setMessage("Admin session not found. Please login again.");
            return;
        }

        const rows = bulkImportRows.map((row) => ({
            externalQuestionKey: getBulkImportCsvValue(
                bulkImportHeaders,
                row,
                "externalQuestionKey"
            ).trim(),
            categoryExternalKey: getBulkImportCsvValue(
                bulkImportHeaders,
                row,
                "categoryExternalKey"
            ).trim(),
        }));

        setIsBulkImportDryRunning(true);

        try {
            const response = await fetch(
                API_BASE_URL + "/api/questions/bulk-import/dry-run",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: "Bearer " + savedToken,
                    },
                    body: JSON.stringify({ rows }),
                }
            );

            const result =
                (await response.json()) as BulkImportDryRunResponse;

            if (response.status === 401 || response.status === 403) {
                clearAdminSessionStorage();
                setIsAllowed(false);
                setAdminRole("");
                setMessage(
                    result.message ||
                        "Your admin session has expired. Please login again."
                );
                return;
            }

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Backend dry run could not be completed."
                );
            }

            if (
                result.dryRun !== true ||
                result.writesPerformed !== 0 ||
                !result.summary ||
                !Array.isArray(result.data)
            ) {
                throw new Error(
                    "Unsafe or malformed backend dry-run response was rejected."
                );
            }

            setBulkImportDryRun(result);
        } catch (error) {
            setBulkImportDryRunError(
                error instanceof Error
                    ? error.message
                    : "Backend dry run could not be completed."
            );
        } finally {
            setIsBulkImportDryRunning(false);
        }
    };
    const handleQuestionCategoryFilterChange = (categoryId: string) => {
        const savedToken =
            window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "";

        setQuestionCategoryFilter(categoryId);

        if (savedToken) {
            void loadQuestions(
                savedToken,
                showInactiveQuestions,
                categoryId,
                questionSourceFilter
            );
        }
    };

    const handleQuestionSourceFilterChange = (
        sourceType: QuestionSourceFilter
    ) => {
        const savedToken =
            window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "";

        setQuestionSourceFilter(sourceType);

        if (savedToken) {
            void loadQuestions(
                savedToken,
                showInactiveQuestions,
                questionCategoryFilter,
                sourceType
            );
        }
    };

    const handleQuestionEditorialFilterChange = (
        editorialFilter: QuestionEditorialFilter
    ) => {
        closeEditorialReview();
        setQuestionEditorialFilter(editorialFilter);
    };

    const handleShowInactiveQuestionsChange = (checked: boolean) => {
        const savedToken =
            window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "";

        setShowInactiveQuestions(checked);

        if (savedToken) {
            void loadQuestions(
                savedToken,
                checked,
                questionCategoryFilter,
                questionSourceFilter
            );
        }
    };

    const handleDisableQuestion = async (question: Question) => {
        if (question.isActive === false) {
            return;
        }

        const shouldDisable = window.confirm(
            "Disable this question? It will be hidden from active question lists."
        );

        if (!shouldDisable) {
            return;
        }

        const savedToken =
            window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "";

        if (!savedToken) {
            clearAdminSessionStorage();
            setIsAllowed(false);
            setAdminRole("");
            setMessage("Please login with an admin account.");
            return;
        }

        setDisablingQuestionId(question._id);

        try {
            const response = await fetch(
                API_BASE_URL + "/api/questions/" + question._id + "/disable",
                {
                    method: "PATCH",
                    headers: {
                        Authorization: "Bearer " + savedToken,
                    },
                }
            );

            const result = (await response.json()) as QuestionMutationResponse;

            if (response.status === 401 || response.status === 403) {
                clearAdminSessionStorage();
                setIsAllowed(false);
                setAdminRole("");
                setMessage(
                    result.message ||
                        "Your admin session has expired. Please login again."
                );
                return;
            }

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to disable question.");
            }

            setQuestions((current) => {
                if (!showInactiveQuestions) {
                    return current.filter((item) => item._id !== question._id);
                }

                return current.map((item) =>
                    item._id === question._id
                        ? {
                              ...item,
                              isActive: false,
                          }
                        : item
                );
            });

            if (editingQuestionId === question._id) {
                cancelEditQuestion();
            }

            showToast({
                type: "success",
                message: "Question disabled successfully.",
            });
        } catch (error) {
            showToast({
                type: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "Unable to disable question.",
            });
        } finally {
            setDisablingQuestionId("");
        }
    };

    const handleEditorialApproval = async (question: Question) => {
        if (adminRole !== "super_admin" && adminRole !== "tenant_admin") {
            showToast({
                type: "error",
                message: "Final editorial approval requires a privileged admin account.",
            });
            return;
        }

        if (
            !isImportedQuestion(question) ||
            isQuestionEditoriallyApproved(question)
        ) {
            showToast({
                type: "error",
                message: "This Question is not eligible for final editorial approval.",
            });
            return;
        }

        if (!editorialAnswerAttested || !editorialLanguageAttested) {
            showToast({
                type: "error",
                message: "Verify both editorial attestations before approval.",
            });
            return;
        }

        const expectedUpdatedAt = question.updatedAt?.trim() || "";

        if (
            !expectedUpdatedAt ||
            Number.isNaN(new Date(expectedUpdatedAt).getTime())
        ) {
            showToast({
                type: "error",
                message: "The reviewed Question revision timestamp is unavailable. Refresh and review again.",
            });
            return;
        }

        const savedToken =
            window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "";

        if (!savedToken) {
            clearAdminSessionStorage();
            setIsAllowed(false);
            setAdminRole("");
            setMessage("Please login with an admin account.");
            closeEditorialReview();
            return;
        }

        if (editorialApprovalInFlightRef.current) {
            return;
        }

        editorialApprovalInFlightRef.current = true;
        setApprovingQuestionId(question._id);

        try {
            const response = await fetch(
                API_BASE_URL +
                    "/api/questions/" +
                    question._id +
                    "/editorial-approval",
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: "Bearer " + savedToken,
                    },
                    body: JSON.stringify({
                        action: "approve",
                        expectedUpdatedAt,
                        attestAnswerAccuracy: true,
                        attestBilingualQuality: true,
                    }),
                }
            );

            const result = (await response.json()) as {
                success: boolean;
                message?: string;
                currentUpdatedAt?: string | null;
                data?: {
                    _id?: string;
                    externalQuestionKey?: string;
                    importMetadata?: QuestionImportMetadata;
                    updatedAt?: string;
                };
            };

            if (response.status === 401 || response.status === 403) {
                clearAdminSessionStorage();
                setIsAllowed(false);
                setAdminRole("");
                setMessage(
                    result.message ||
                        "Your admin session has expired. Please login again."
                );
                closeEditorialReview();
                return;
            }

            if (response.status === 409) {
                closeEditorialReview();

                await loadQuestions(
                    savedToken,
                    showInactiveQuestions,
                    questionCategoryFilter,
                    questionSourceFilter
                );

                showToast({
                    type: "error",
                    message:
                        result.message ||
                        "Question revision changed. Reloaded the latest revision; review it again before approval.",
                });
                return;
            }

            const approvalData = result.data;

            if (
                !response.ok ||
                !result.success ||
                !approvalData ||
                approvalData._id !== question._id ||
                !approvalData.importMetadata ||
                !approvalData.updatedAt ||
                Number.isNaN(new Date(approvalData.updatedAt).getTime())
            ) {
                throw new Error(
                    result.message ||
                        "Unable to record editorial approval."
                );
            }

            setQuestions((current) =>
                current.map((item) =>
                    item._id === question._id
                        ? {
                              ...item,
                              externalQuestionKey:
                                  approvalData.externalQuestionKey ??
                                  item.externalQuestionKey,
                              importMetadata: approvalData.importMetadata,
                              updatedAt: approvalData.updatedAt,
                          }
                        : item
                )
            );

            closeEditorialReview();

            showToast({
                type: "success",
                message:
                    result.message ||
                    "Question editorial approval recorded.",
            });
        } catch (error) {
            showToast({
                type: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "Unable to record editorial approval.",
            });
        } finally {
            editorialApprovalInFlightRef.current = false;
            setApprovingQuestionId("");
        }
    };

    useEffect(() => {
        const verifyAdminSession = async () => {
            const savedToken =
                window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "";

            if (!savedToken) {
                clearAdminSessionStorage();
                setMessage("Please login with an admin account.");
                setIsAllowed(false);
                setAdminRole("");
                setIsReady(true);
                return;
            }

            try {
                const response = await fetch(API_BASE_URL + "/api/auth/me", {
                    headers: {
                        Authorization: "Bearer " + savedToken,
                    },
                });

                const result = (await response.json()) as MeResponse;

                if (!response.ok || !result.success || !result.data) {
                    throw new Error(result.message || "Admin session expired.");
                }

                if (!isAllowedAdminRole(result.data.role)) {
                    throw new Error("Please login with an admin account.");
                }

                setAdminRole(result.data.role || "");

                window.localStorage.setItem(
                    ADMIN_PROFILE_STORAGE_KEY,
                    JSON.stringify(result.data)
                );

                setIsAllowed(true);
                setMessage("");
                void loadQuestions(savedToken, false);
                void loadCategories(savedToken);
                void loadQuestionGroups(savedToken);
            } catch (error) {
                clearAdminSessionStorage();
                setIsAllowed(false);
                setAdminRole("");
                setMessage(
                    error instanceof Error
                        ? error.message
                        : "Admin session expired. Please login again."
                );
            } finally {
                setIsReady(true);
            }
        };

        void verifyAdminSession();
    }, []);

    if (!isReady) {
        return (
            <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-950">
                <div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
                    <p className="text-sm font-semibold text-slate-600">
                        Loading admin session...
                    </p>
                </div>
            </main>
        );
    }

    if (!isAllowed) {
        return (
            <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-950">
                <div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
                    <p className="text-sm font-semibold uppercase tracking-wide text-red-600">
                        Admin Access
                    </p>

                    <h1 className="mt-2 text-2xl font-bold">
                        Login required
                    </h1>

                    <p className="mt-3 text-sm text-slate-600">
                        {message || "Please login with an admin account."}
                    </p>

                    <Link
                        href="/admin/login"
                        className="mt-5 inline-flex rounded-2xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800"
                    >
                        Go to Admin Login
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
            {toast ? (
                <div className="fixed right-4 top-4 z-50 max-w-sm rounded-2xl bg-white p-4 text-sm font-semibold shadow-lg ring-1 ring-slate-200">
                    <p
                        className={
                            toast.type === "success"
                                ? "text-emerald-700"
                                : "text-red-700"
                        }
                    >
                        {toast.message}
                    </p>
                </div>
            ) : null}

            <div className="mx-auto flex max-w-6xl flex-col gap-6">
                <header className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-700">
                                Mock-Test Admin
                            </p>

                            <h1 className="mt-2 text-3xl font-bold">
                                Question Bank
                            </h1>

                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                Manage MCQ questions, options, correct answers,
                                explanations, difficulty, and optional question
                                group linking.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <Link
                                href="/admin/dashboard"
                                className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                            >
                                Dashboard
                            </Link>
                        </div>
                    </div>
                </header>

                <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {editingQuestionId
                                    ? "T-42N Step 4"
                                    : "T-42N Step 3"}
                            </p>

                            <h2 className="mt-2 text-xl font-bold">
                                {editingQuestionId
                                    ? "Edit MCQ Question"
                                    : "Create MCQ Question"}
                            </h2>

                            <p className="mt-3 text-sm leading-6 text-slate-600">
                                {editingQuestionId
                                    ? "Update a single-correct MCQ question safely."
                                    : "Add single-correct MCQ questions and optionally link them to an active question group."}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                if (editingQuestionId) {
                                    cancelEditQuestion();
                                    return;
                                }

                                setIsCreateFormOpen((value) => !value);
                            }}
                            className="w-fit rounded-2xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
                        >
                            {editingQuestionId
                                ? "Cancel Edit"
                                : isCreateFormOpen
                                  ? "Close Form"
                                  : "Add Question"}
                        </button>
                    </div>

                    {isCreateFormOpen ? (
                        <form
                            onSubmit={
                                editingQuestionId
                                    ? handleUpdateQuestion
                                    : handleCreateQuestion
                            }
                            className="mt-5 grid gap-5 rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200"
                        >
                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Question Text English
                                    <textarea
                                        value={createQuestionForm.questionTextEn}
                                        onChange={(event) =>
                                            updateCreateQuestionForm(
                                                "questionTextEn",
                                                event.target.value
                                            )
                                        }
                                        rows={4}
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                        placeholder="Enter English question text"
                                    />
                                </label>

                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Question Text Hindi
                                    <textarea
                                        value={createQuestionForm.questionTextHi}
                                        onChange={(event) =>
                                            updateCreateQuestionForm(
                                                "questionTextHi",
                                                event.target.value
                                            )
                                        }
                                        rows={4}
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                        placeholder="Hindi question text"
                                    />
                                </label>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Category
                                    <select
                                        value={createQuestionForm.categoryId}
                                        onChange={(event) =>
                                            updateCreateQuestionForm(
                                                "categoryId",
                                                event.target.value
                                            )
                                        }
                                        disabled={isCategoriesLoading}
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                                    >
                                        <option value="">No category</option>
                                        {categories.map((category) => (
                                            <option
                                                key={category._id}
                                                value={category._id}
                                                disabled={
                                                    category.isActive === false &&
                                                    createQuestionForm.categoryId !==
                                                        category._id
                                                }
                                            >
                                                {category.name || category.slug}
                                                {category.isActive === false
                                                    ? " (Inactive)"
                                                    : ""}
                                            </option>
                                        ))}
                                    </select>
                                    <span className="text-xs font-normal text-slate-500">
                                        {isCategoriesLoading
                                            ? "Loading categories..."
                                            : "Use an exam-specific category when applicable."}
                                    </span>
                                </label>

                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Subject
                                    <input
                                        value={createQuestionForm.subject}
                                        onChange={(event) =>
                                            updateCreateQuestionForm(
                                                "subject",
                                                event.target.value
                                            )
                                        }
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                        placeholder="Reasoning"
                                    />
                                </label>

                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Topic
                                    <input
                                        value={createQuestionForm.topic}
                                        onChange={(event) =>
                                            updateCreateQuestionForm(
                                                "topic",
                                                event.target.value
                                            )
                                        }
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                        placeholder="Seating Arrangement"
                                    />
                                </label>

                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Sub Topic
                                    <input
                                        value={createQuestionForm.subTopic}
                                        onChange={(event) =>
                                            updateCreateQuestionForm(
                                                "subTopic",
                                                event.target.value
                                            )
                                        }
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                        placeholder="Linear arrangement"
                                    />
                                </label>

                                {categoriesError ? (
                                    <div className="md:col-span-2 xl:col-span-4 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700 ring-1 ring-red-100">
                                        {categoriesError}
                                    </div>
                                ) : null}
                            </div>

                            <div className="grid gap-4 md:grid-cols-5">
                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Source
                                    <select
                                        value={createQuestionForm.sourceType}
                                        onChange={(event) =>
                                            updateCreateQuestionForm(
                                                "sourceType",
                                                event.target.value
                                            )
                                        }
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                    >
                                        <option value="original">Original</option>
                                        <option value="pyq">PYQ</option>
                                    </select>
                                </label>

                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Difficulty
                                    <select
                                        value={createQuestionForm.difficulty}
                                        onChange={(event) =>
                                            updateCreateQuestionForm(
                                                "difficulty",
                                                event.target.value
                                            )
                                        }
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                    >
                                        <option value="easy">Easy</option>
                                        <option value="medium">Medium</option>
                                        <option value="hard">Hard</option>
                                    </select>
                                </label>

                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Marks
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.25"
                                        value={createQuestionForm.marks}
                                        onChange={(event) =>
                                            updateCreateQuestionForm(
                                                "marks",
                                                event.target.value
                                            )
                                        }
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                    />
                                </label>

                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Negative
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.25"
                                        value={createQuestionForm.negativeMarks}
                                        onChange={(event) =>
                                            updateCreateQuestionForm(
                                                "negativeMarks",
                                                event.target.value
                                            )
                                        }
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                    />
                                </label>

                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Correct Option
                                    <select
                                        value={createQuestionForm.correctOptionId}
                                        onChange={(event) =>
                                            updateCreateQuestionForm(
                                                "correctOptionId",
                                                event.target.value
                                            )
                                        }
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                    >
                                        {OPTION_IDS.map((optionId) => (
                                            <option key={optionId} value={optionId}>
                                                {optionId}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                                <div className="flex flex-col gap-1">
                                    <h3 className="text-sm font-bold text-slate-950">
                                        Options
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        At least two options are required. Correct
                                        option must have text.
                                    </p>
                                </div>

                                <div className="mt-4 grid gap-4 md:grid-cols-2">
                                    {createQuestionForm.options.map((option) => (
                                        <div
                                            key={option.optionId}
                                            className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"
                                        >
                                            <p className="text-sm font-bold text-slate-900">
                                                Option {option.optionId}
                                            </p>

                                            <div className="mt-3 grid gap-3">
                                                <input
                                                    value={option.textEn}
                                                    onChange={(event) =>
                                                        updateCreateOption(
                                                            option.optionId,
                                                            "textEn",
                                                            event.target.value
                                                        )
                                                    }
                                                    className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
                                                    placeholder="English option text"
                                                />

                                                <input
                                                    value={option.textHi}
                                                    onChange={(event) =>
                                                        updateCreateOption(
                                                            option.optionId,
                                                            "textHi",
                                                            event.target.value
                                                        )
                                                    }
                                                    className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
                                                    placeholder="Hindi option text"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Explanation English
                                    <textarea
                                        value={createQuestionForm.explanationEn}
                                        onChange={(event) =>
                                            updateCreateQuestionForm(
                                                "explanationEn",
                                                event.target.value
                                            )
                                        }
                                        rows={3}
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                        placeholder="Optional explanation"
                                    />
                                </label>

                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Explanation Hindi
                                    <textarea
                                        value={createQuestionForm.explanationHi}
                                        onChange={(event) =>
                                            updateCreateQuestionForm(
                                                "explanationHi",
                                                event.target.value
                                            )
                                        }
                                        rows={3}
                                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-blue-500"
                                        placeholder="Optional Hindi explanation"
                                    />
                                </label>
                            </div>

                            <div className="grid gap-4 rounded-2xl bg-blue-50 p-4 ring-1 ring-blue-100 md:grid-cols-2">
                                <label className="grid gap-2 text-sm font-semibold text-blue-950">
                                    Optional Question Group
                                    <select
                                        value={createQuestionForm.questionGroupId}
                                        onChange={(event) =>
                                            updateCreateQuestionForm(
                                                "questionGroupId",
                                                event.target.value
                                            )
                                        }
                                        className="rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm font-normal text-slate-900 outline-none focus:border-blue-500"
                                    >
                                        <option value="">No group</option>
                                        {questionGroups.map((group) => (
                                            <option key={group._id} value={group._id}>
                                                {group.title || group.slug}
                                            </option>
                                        ))}
                                    </select>
                                    <span className="text-xs font-normal text-blue-800">
                                        {isQuestionGroupsLoading
                                            ? "Loading active groups..."
                                            : questionGroups.length +
                                              " active groups available"}
                                    </span>
                                </label>

                                <label className="grid gap-2 text-sm font-semibold text-blue-950">
                                    Group Question Order
                                    <input
                                        type="number"
                                        min="1"
                                        value={createQuestionForm.groupQuestionOrder}
                                        onChange={(event) =>
                                            updateCreateQuestionForm(
                                                "groupQuestionOrder",
                                                event.target.value
                                            )
                                        }
                                        disabled={!createQuestionForm.questionGroupId}
                                        className="rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm font-normal text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                                        placeholder="Required if group selected"
                                    />
                                    <span className="text-xs font-normal text-blue-800">
                                        Use 1, 2, 3... for questions inside a
                                        linked group.
                                    </span>
                                </label>

                                {questionGroupsError ? (
                                    <div className="md:col-span-2 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700 ring-1 ring-red-100">
                                        {questionGroupsError}
                                    </div>
                                ) : null}
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <button
                                    type="submit"
                                    disabled={isCreateSaving}
                                    className="rounded-2xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                                >
                                    {isCreateSaving
                                        ? editingQuestionId
                                            ? "Saving..."
                                            : "Creating..."
                                        : editingQuestionId
                                          ? "Save Changes"
                                          : "Create Question"}
                                </button>

                                <button
                                    type="button"
                                    onClick={
                                        editingQuestionId
                                            ? cancelEditQuestion
                                            : resetCreateQuestionForm
                                    }
                                    disabled={isCreateSaving}
                                    className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                >
                                    {editingQuestionId ? "Cancel Edit" : "Reset"}
                                </button>
                            </div>
                        </form>
                    ) : null}
                </section>

                                <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                                PCRT-B1D
                            </p>

                            <h2 className="mt-2 text-xl font-bold">
                                Bulk Import Questions
                            </h2>

                            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                                Select, parse and validate a CSV locally in your browser
                                before any controlled backend dry run. No question data
                                is sent to the backend in this step.
                            </p>
                        </div>

                        <span className="w-fit rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
                            Local validation + backend dry run
                        </span>
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Import Format
                                    <select
                                        value="csv"
                                        disabled
                                        className="rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm font-normal text-slate-500"
                                    >
                                        <option value="csv">CSV</option>
                                    </select>
                                </label>

                                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                                    Question File
                                    <input
                                        type="file"
                                        accept=".csv,text/csv"
                                        onChange={(event) =>
                                            void handleBulkImportFileChange(
                                                event.target.files?.[0] || null
                                            )
                                        }
                                        disabled={isBulkImportParsing}
                                        className="block w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-700 file:mr-3 file:rounded-xl file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-blue-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                                    />
                                </label>
                            </div>

                            <p className="mt-4 text-xs leading-5 text-slate-500">
                                Parsing is local and handles quoted commas, escaped
                                quotes and multiline quoted fields.
                            </p>

                            {bulkImportParseError ? (
                                <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700 ring-1 ring-red-100">
                                    {bulkImportParseError}
                                </div>
                            ) : null}
                        </div>

                        <div className="rounded-2xl bg-blue-50 p-5 ring-1 ring-blue-100">
                            <p className="text-sm font-bold text-blue-950">
                                Local parse summary
                            </p>

                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl bg-white p-3 ring-1 ring-blue-100">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Selected File
                                    </p>
                                    <p className="mt-1 break-all text-sm font-semibold text-slate-800">
                                        {bulkImportFileName || "No file selected"}
                                    </p>
                                </div>

                                <div className="rounded-2xl bg-white p-3 ring-1 ring-blue-100">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        File Size
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-slate-800">
                                        {bulkImportFileName
                                            ? formatBulkImportFileSize(
                                                  bulkImportFileSize
                                              )
                                            : "-"}
                                    </p>
                                </div>

                                <div className="rounded-2xl bg-white p-3 ring-1 ring-blue-100">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Rows Detected
                                    </p>
                                    <p className="mt-1 text-lg font-bold text-slate-950">
                                        {bulkImportRows.length}
                                    </p>
                                </div>

                                <div className="rounded-2xl bg-white p-3 ring-1 ring-blue-100">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Columns Detected
                                    </p>
                                    <p className="mt-1 text-lg font-bold text-slate-950">
                                        {bulkImportHeaders.length}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-3 rounded-2xl bg-white p-3 ring-1 ring-blue-100">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Parse Status
                                </p>

                                <p
                                    className={
                                        "mt-1 text-sm font-semibold " +
                                        (bulkImportParseError
                                            ? "text-red-700"
                                            : bulkImportRows.length > 0
                                              ? "text-emerald-700"
                                              : "text-slate-600")
                                    }
                                >
                                    {isBulkImportParsing
                                        ? "Parsing locally..."
                                        : bulkImportParseError
                                          ? "Parse error"
                                          : bulkImportRows.length > 0
                                            ? "Ready for local preview"
                                            : "Waiting for CSV"}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                        <button
                            type="button"
                            onClick={() => setShowBulkImportPreview(true)}
                            disabled={
                                isBulkImportParsing ||
                                bulkImportRows.length === 0 ||
                                Boolean(bulkImportParseError)
                            }
                            className="w-fit rounded-2xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                        >
                            Preview Parsed Rows
                        </button>

                        <button
                            type="button"
                            onClick={handleValidateBulkImportCsv}
                            disabled={
                                isBulkImportParsing ||
                                bulkImportRows.length === 0 ||
                                Boolean(bulkImportParseError)
                            }
                            className="w-fit rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                        >
                            Validate CSV
                        </button>

                        <p className="text-xs leading-5 text-slate-500">
                            Local validation runs first — backend dry run sends only external keys and must perform zero
                            writes.
                        </p>
                    </div>

                    {bulkImportValidation ? (
                        <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm font-bold text-slate-950">
                                        Backend Resolver Dry Run
                                    </p>

                                    <p className="mt-1 text-xs leading-5 text-slate-600">
                                        Sends only the external question key and category
                                        external key. This step must perform zero Question
                                        writes.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        void handleBulkImportBackendDryRun()
                                    }
                                    disabled={
                                        bulkImportValidation.errorCount > 0 ||
                                        isBulkImportDryRunning
                                    }
                                    className="w-fit rounded-2xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                                >
                                    {isBulkImportDryRunning
                                        ? "Resolving..."
                                        : "Run Backend Dry Run"}
                                </button>
                            </div>
                        </div>
                    ) : null}

                    {bulkImportDryRunError ? (
                        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                            {bulkImportDryRunError}
                        </div>
                    ) : null}

                    {bulkImportDryRun?.summary ? (
                        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <p className="text-sm font-bold text-slate-950">
                                        Backend Resolution Summary
                                    </p>

                                    <p className="mt-1 text-xs leading-5 text-slate-500">
                                        Authorized tenant:{" "}
                                        {bulkImportDryRun.targetTenantId || "-"}
                                    </p>
                                </div>

                                <span className="w-fit rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                                    Zero writes confirmed
                                </span>
                            </div>

                            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                                <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Rows
                                    </p>
                                    <p className="mt-1 text-2xl font-bold text-slate-950">
                                        {bulkImportDryRun.summary.rowsReceived}
                                    </p>
                                </div>

                                <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Resolved
                                    </p>
                                    <p className="mt-1 text-2xl font-bold text-emerald-700">
                                        {bulkImportDryRun.summary.resolvedRows}
                                    </p>
                                </div>

                                <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Blocked
                                    </p>
                                    <p className="mt-1 text-2xl font-bold text-red-700">
                                        {bulkImportDryRun.summary.blockedRows}
                                    </p>
                                </div>

                                <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Category Keys
                                    </p>
                                    <p className="mt-1 text-2xl font-bold text-slate-950">
                                        {bulkImportDryRun.summary.uniqueCategoryKeys}
                                    </p>
                                </div>

                                <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Categories Resolved
                                    </p>
                                    <p className="mt-1 text-2xl font-bold text-emerald-700">
                                        {bulkImportDryRun.summary.resolvedCategoryKeys}
                                    </p>
                                </div>

                                <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Unresolved
                                    </p>
                                    <p className="mt-1 text-2xl font-bold text-red-700">
                                        {bulkImportDryRun.summary.unresolvedCategoryKeys}
                                    </p>
                                </div>
                            </div>

                            {(bulkImportDryRun.data || []).length > 0 ? (
                                <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                Resolver Diagnostics
                                            </p>

                                            <p className="mt-1 text-xs leading-5 text-slate-500">
                                                Showing up to 25 backend resolution rows.
                                                Blocked rows are shown first.
                                            </p>
                                        </div>

                                        <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                            {Math.min(
                                                25,
                                                (bulkImportDryRun.data || []).length
                                            )}{" "}
                                            of {(bulkImportDryRun.data || []).length}
                                        </span>
                                    </div>

                                    <div className="mt-4 overflow-x-auto">
                                        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                                            <thead className="bg-slate-50">
                                                <tr>
                                                    <th className="px-4 py-3 font-semibold text-slate-700">
                                                        Row
                                                    </th>
                                                    <th className="px-4 py-3 font-semibold text-slate-700">
                                                        External Key
                                                    </th>
                                                    <th className="px-4 py-3 font-semibold text-slate-700">
                                                        Status
                                                    </th>
                                                    <th className="px-4 py-3 font-semibold text-slate-700">
                                                        Category External Key
                                                    </th>
                                                    <th className="min-w-[320px] px-4 py-3 font-semibold text-slate-700">
                                                        Resolution
                                                    </th>
                                                </tr>
                                            </thead>

                                            <tbody className="divide-y divide-slate-100 bg-white">
                                                {[...(bulkImportDryRun.data || [])]
                                                    .sort((left, right) => {
                                                        if (
                                                            left.status !==
                                                            right.status
                                                        ) {
                                                            return left.status ===
                                                                "blocked"
                                                                ? -1
                                                                : 1;
                                                        }

                                                        return (
                                                            left.rowNumber -
                                                            right.rowNumber
                                                        );
                                                    })
                                                    .slice(0, 25)
                                                    .map((row) => (
                                                        <tr
                                                            key={
                                                                row.rowNumber +
                                                                "-" +
                                                                row.externalQuestionKey
                                                            }
                                                            className="align-top"
                                                        >
                                                            <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">
                                                                {row.rowNumber}
                                                            </td>

                                                            <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-700">
                                                                {row.externalQuestionKey ||
                                                                    "-"}
                                                            </td>

                                                            <td className="whitespace-nowrap px-4 py-3">
                                                                <span
                                                                    className={
                                                                        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 " +
                                                                        (row.status ===
                                                                        "blocked"
                                                                            ? "bg-red-50 text-red-700 ring-red-100"
                                                                            : "bg-emerald-50 text-emerald-700 ring-emerald-100")
                                                                    }
                                                                >
                                                                    {row.status ===
                                                                    "blocked"
                                                                        ? "Blocked"
                                                                        : "Resolved"}
                                                                </span>
                                                            </td>

                                                            <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-700">
                                                                {row.categoryExternalKey ||
                                                                    "-"}
                                                            </td>

                                                            <td className="px-4 py-3 text-slate-700">
                                                                {row.category ? (
                                                                    <div className="grid gap-1">
                                                                        <span className="font-semibold text-slate-900">
                                                                            {row
                                                                                .category
                                                                                .name ||
                                                                                "-"}
                                                                        </span>

                                                                        <span className="font-mono text-xs text-slate-600">
                                                                            slug:{" "}
                                                                            {
                                                                                row
                                                                                    .category
                                                                                    .slug
                                                                            }
                                                                        </span>

                                                                        <span className="font-mono text-xs text-slate-600">
                                                                            id:{" "}
                                                                            {
                                                                                row
                                                                                    .category
                                                                                    ._id
                                                                            }
                                                                        </span>

                                                                        <span className="text-xs text-slate-500">
                                                                            {row
                                                                                .category
                                                                                .isActive ===
                                                                            false
                                                                                ? "Inactive category"
                                                                                : "Active category"}
                                                                        </span>
                                                                    </div>
                                                                ) : row.issues &&
                                                                  row.issues.length >
                                                                      0 ? (
                                                                    <div className="grid gap-1">
                                                                        {row.issues.map(
                                                                            (
                                                                                issue,
                                                                                issueIndex
                                                                            ) => (
                                                                                <p
                                                                                    key={
                                                                                        row.rowNumber +
                                                                                        "-issue-" +
                                                                                        issueIndex
                                                                                    }
                                                                                    className="text-xs leading-5 text-red-700"
                                                                                >
                                                                                    {issue.field
                                                                                        ? issue.field +
                                                                                          ": "
                                                                                        : ""}
                                                                                    {issue.message ||
                                                                                        "Resolver issue"}
                                                                                </p>
                                                                            )
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-xs text-slate-500">
                                                                        No resolution details.
                                                                    </span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {(bulkImportDryRun.data || []).length > 25 ? (
                                        <p className="mt-3 text-xs leading-5 text-slate-500">
                                            {(bulkImportDryRun.data || []).length -
                                                25}{" "}
                                            additional backend resolution rows are
                                            not shown.
                                        </p>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                    {bulkImportValidation ? (
                        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <p className="text-sm font-bold text-slate-950">
                                        Validation Summary
                                    </p>

                                    <p className="mt-1 text-xs leading-5 text-slate-500">
                                        Structural checks run only against the locally
                                        parsed CSV. Category/group resolution is not
                                        performed yet.
                                    </p>
                                </div>

                                <span
                                    className={
                                        "w-fit rounded-full px-3 py-1.5 text-xs font-semibold ring-1 " +
                                        (bulkImportValidation.errorCount > 0
                                            ? "bg-red-50 text-red-700 ring-red-100"
                                            : bulkImportValidation.warningCount > 0
                                              ? "bg-amber-50 text-amber-700 ring-amber-100"
                                              : "bg-emerald-50 text-emerald-700 ring-emerald-100")
                                    }
                                >
                                    {bulkImportValidation.errorCount > 0
                                        ? "Blocked by errors"
                                        : bulkImportValidation.warningCount > 0
                                          ? "Valid with warnings"
                                          : "Validation passed"}
                                </span>
                            </div>

                            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Errors
                                    </p>
                                    <p className="mt-1 text-2xl font-bold text-red-700">
                                        {bulkImportValidation.errorCount}
                                    </p>
                                </div>

                                <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Warnings
                                    </p>
                                    <p className="mt-1 text-2xl font-bold text-amber-700">
                                        {bulkImportValidation.warningCount}
                                    </p>
                                </div>

                                <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Structurally Valid Rows
                                    </p>
                                    <p className="mt-1 text-2xl font-bold text-emerald-700">
                                        {bulkImportValidation.validRowCount}
                                    </p>
                                </div>

                                <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Blocked Rows
                                    </p>
                                    <p className="mt-1 text-2xl font-bold text-slate-950">
                                        {bulkImportValidation.invalidRowCount}
                                    </p>
                                </div>
                            </div>

                            {bulkImportValidation.issues.length > 0 ? (
                                <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                Validation Diagnostics
                                            </p>

                                            <p className="mt-1 text-xs leading-5 text-slate-500">
                                                Showing up to 25 local validation issues.
                                                Errors are shown before warnings.
                                            </p>
                                        </div>

                                        <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                            {Math.min(
                                                25,
                                                bulkImportValidation.issues.length
                                            )}{" "}
                                            of {bulkImportValidation.issues.length}
                                        </span>
                                    </div>

                                    <div className="mt-4 max-h-[32rem] overflow-auto rounded-xl ring-1 ring-slate-200">
                                        {[...bulkImportValidation.issues]
                                            .sort((left, right) => {
                                                if (left.severity === right.severity) {
                                                    return (
                                                        (left.rowNumber ?? 0) -
                                                        (right.rowNumber ?? 0)
                                                    );
                                                }

                                                return left.severity === "error" ? -1 : 1;
                                            })
                                            .slice(0, 25)
                                            .map((issue, index) => (
                                                <div
                                                    key={`${issue.severity}-${issue.rowNumber ?? "csv"}-${issue.field}-${index}`}
                                                    className="border-b border-slate-100 p-4 last:border-b-0"
                                                >
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span
                                                            className={
                                                                "rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide " +
                                                                (issue.severity === "error"
                                                                    ? "bg-red-50 text-red-700"
                                                                    : "bg-amber-50 text-amber-700")
                                                            }
                                                        >
                                                            {issue.severity}
                                                        </span>

                                                        <span className="text-xs font-semibold text-slate-700">
                                                            {issue.rowNumber
                                                                ? `Row ${issue.rowNumber}`
                                                                : "CSV"}
                                                        </span>

                                                        <span className="text-xs text-slate-400">
                                                            •
                                                        </span>

                                                        <span className="text-xs font-medium text-slate-600">
                                                            Field: {issue.field}
                                                        </span>
                                                    </div>

                                                    {issue.externalQuestionKey ? (
                                                        <p className="mt-2 break-all font-mono text-xs text-blue-700">
                                                            {issue.externalQuestionKey}
                                                        </p>
                                                    ) : null}

                                                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-800">
                                                        {issue.message}
                                                    </p>
                                                </div>
                                            ))}
                                    </div>

                                    {bulkImportValidation.issues.length > 25 ? (
                                        <p className="mt-3 text-xs leading-5 text-slate-500">
                                            {bulkImportValidation.issues.length - 25}{" "}
                                            additional issue(s) are not shown in this
                                            compact preview.
                                        </p>
                                    ) : null}
                                </div>
                            ) : (
                                <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-100">
                                    No structural errors or editorial warnings were
                                    detected.
                                </div>
                            )}
                        </div>
                    ) : null}
                    {showBulkImportPreview &&
                    bulkImportRows.length > 0 &&
                    !bulkImportParseError ? (
                        <div className="mt-5 rounded-2xl border border-slate-200 bg-white">
                            <div className="flex flex-col gap-2 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm font-bold text-slate-950">
                                        Local CSV Preview
                                    </p>

                                    <p className="mt-1 text-xs text-slate-500">
                                        Showing the first{" "}
                                        {Math.min(
                                            BULK_IMPORT_PREVIEW_LIMIT,
                                            bulkImportRows.length
                                        )}{" "}
                                        of {bulkImportRows.length} parsed rows.
                                    </p>
                                </div>

                                <span className="w-fit rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                                    Nothing saved
                                </span>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="min-w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                        <tr>
                                            <th className="px-4 py-3">Row</th>
                                            <th className="px-4 py-3">
                                                External Question Key
                                            </th>
                                            <th className="px-4 py-3">
                                                Category Key
                                            </th>
                                            <th className="px-4 py-3">
                                                Source
                                            </th>
                                            <th className="px-4 py-3">
                                                Subject
                                            </th>
                                            <th className="px-4 py-3">
                                                Topic
                                            </th>
                                            <th className="px-4 py-3">
                                                Question English
                                            </th>
                                            <th className="px-4 py-3">
                                                Question Hindi
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-slate-100">
                                        {bulkImportRows
                                            .slice(
                                                0,
                                                BULK_IMPORT_PREVIEW_LIMIT
                                            )
                                            .map((row, index) => (
                                                <tr key={index}>
                                                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">
                                                        {index + 1}
                                                    </td>

                                                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800">
                                                        {getBulkImportCsvValue(
                                                            bulkImportHeaders,
                                                            row,
                                                            "externalQuestionKey"
                                                        ) || "-"}
                                                    </td>

                                                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                                                        {getBulkImportCsvValue(
                                                            bulkImportHeaders,
                                                            row,
                                                            "categoryExternalKey"
                                                        ) || "-"}
                                                    </td>

                                                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                                                        {getBulkImportCsvValue(
                                                            bulkImportHeaders,
                                                            row,
                                                            "sourceType"
                                                        ) || "-"}
                                                    </td>

                                                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                                                        {getBulkImportCsvValue(
                                                            bulkImportHeaders,
                                                            row,
                                                            "subject"
                                                        ) || "-"}
                                                    </td>

                                                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                                                        {getBulkImportCsvValue(
                                                            bulkImportHeaders,
                                                            row,
                                                            "topic"
                                                        ) || "-"}
                                                    </td>

                                                    <td className="min-w-[320px] px-4 py-3 leading-6 text-slate-700">
                                                        {getBulkImportCsvValue(
                                                            bulkImportHeaders,
                                                            row,
                                                            "questionTextEn"
                                                        ) || "-"}
                                                    </td>

                                                    <td className="min-w-[320px] px-4 py-3 leading-6 text-slate-700">
                                                        {getBulkImportCsvValue(
                                                            bulkImportHeaders,
                                                            row,
                                                            "questionTextHi"
                                                        ) || "-"}
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : null}
                </section>
<section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                T-42N Step 5
                            </p>

                            <h2 className="mt-2 text-xl font-bold">
                                Question List
                            </h2>

                            <p className="mt-3 text-sm leading-6 text-slate-600">
                                Connected to{" "}
                                <span className="font-semibold">
                                    /api/questions
                                </span>{" "}
                                for active and inactive MCQ listing.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-end gap-3">
                            <label className="grid min-w-[210px] gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Category
                                <select
                                    value={questionCategoryFilter}
                                    onChange={(event) =>
                                        handleQuestionCategoryFilterChange(
                                            event.target.value
                                        )
                                    }
                                    disabled={isQuestionsLoading}
                                    className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-700 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                                >
                                    <option value="">All Categories</option>

                                    {categories.map((category) => (
                                        <option
                                            key={category._id}
                                            value={category._id}
                                        >
                                            {category.name || category.slug}
                                            {category.isActive === false
                                                ? " (Inactive)"
                                                : ""}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="grid min-w-[160px] gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Source
                                <select
                                    value={questionSourceFilter}
                                    onChange={(event) =>
                                        handleQuestionSourceFilterChange(
                                            event.target
                                                .value as QuestionSourceFilter
                                        )
                                    }
                                    disabled={isQuestionsLoading}
                                    className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-700 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                                >
                                    <option value="all">All Sources</option>
                                    <option value="original">Original</option>
                                    <option value="pyq">PYQ</option>
                                </select>
                            </label>

                            <label className="grid min-w-[180px] gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Editorial QA
                                <select
                                    value={questionEditorialFilter}
                                    onChange={(event) =>
                                        handleQuestionEditorialFilterChange(
                                            event.target
                                                .value as QuestionEditorialFilter
                                        )
                                    }
                                    disabled={isQuestionsLoading}
                                    className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-700 outline-none focus:border-violet-500 disabled:bg-slate-100 disabled:text-slate-400"
                                >
                                    <option value="all">All Questions</option>
                                    <option value="pending">Pending Review</option>
                                    <option value="approved">Approved</option>
                                </select>
                            </label>

                            <label className="flex w-fit items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={showInactiveQuestions}
                                    onChange={(event) =>
                                        handleShowInactiveQuestionsChange(
                                            event.target.checked
                                        )
                                    }
                                    className="h-4 w-4"
                                />
                                Show inactive
                            </label>

                            <button
                                type="button"
                                onClick={() => {
                                    const savedToken =
                                        window.localStorage.getItem(
                                            ADMIN_TOKEN_STORAGE_KEY
                                        ) || "";

                                    if (savedToken) {
                                        void loadQuestions(
                                            savedToken,
                                            showInactiveQuestions,
                                            questionCategoryFilter,
                                            questionSourceFilter
                                        );
                                        void loadCategories(savedToken);
                                        void loadQuestionGroups(savedToken);
                                    }
                                }}
                                disabled={isQuestionsLoading}
                                className="w-fit rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                            >
                                {isQuestionsLoading
                                    ? "Refreshing..."
                                    : "Refresh List"}
                            </button>
                        </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Loaded Questions
                            </p>
                            <p className="mt-2 text-2xl font-bold">
                                {questions.length}
                            </p>
                        </div>

                        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                API
                            </p>
                            <p className="mt-2 break-all text-sm font-semibold text-slate-700">
                                /api/questions
                            </p>
                        </div>

                        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Scope
                            </p>
                            <p className="mt-2 text-sm font-semibold text-slate-700">
                                {showInactiveQuestions
                                    ? "Active and inactive questions"
                                    : "Active questions only"}
                            </p>
                        </div>
                    </div>

                    <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                                    Editorial QA Progress
                                </p>
                                <p className="mt-1 text-sm leading-6 text-slate-600">
                                    Imported-question QA counts for the currently loaded Question Bank scope.
                                </p>
                            </div>

                            <div className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-600 ring-1 ring-violet-100">
                                Viewing:{" "}
                                {questionEditorialFilter === "pending"
                                    ? "Pending Review"
                                    : questionEditorialFilter === "approved"
                                      ? "Approved"
                                      : "All Questions"}
                            </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-xl bg-white p-3 ring-1 ring-violet-100">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Imported
                                </p>
                                <p className="mt-1 text-2xl font-bold text-slate-950">
                                    {importedQuestionCount}
                                </p>
                            </div>

                            <div className="rounded-xl bg-white p-3 ring-1 ring-orange-100">
                                <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">
                                    Pending Review
                                </p>
                                <p className="mt-1 text-2xl font-bold text-slate-950">
                                    {pendingEditorialCount}
                                </p>
                            </div>

                            <div className="rounded-xl bg-white p-3 ring-1 ring-emerald-100">
                                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                                    Approved
                                </p>
                                <p className="mt-1 text-2xl font-bold text-slate-950">
                                    {approvedEditorialCount}
                                </p>
                            </div>
                        </div>

                        {questionEditorialFilter === "pending" &&
                        (adminRole === "super_admin" ||
                            adminRole === "tenant_admin") ? (
                            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-violet-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                                        Sequential Editorial Review
                                    </p>
                                    <p className="mt-1 text-sm leading-6 text-slate-600">
                                        {editorialQueueQuestions.length > 0
                                            ? `Next: ${
                                                  editorialQueueQuestions[0]
                                                      .externalQuestionKey ||
                                                  "Imported question"
                                              }`
                                            : "No pending imported questions remain in the current scope."}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleReviewNextPending}
                                    disabled={
                                        editorialQueueQuestions.length === 0 ||
                                        isQuestionsLoading
                                    }
                                    className="w-fit rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                                >
                                    {editorialQueueQuestions.length === 0
                                        ? "No Pending Reviews"
                                        : "Review Next Pending"}
                                </button>
                            </div>
                        ) : null}
                    </div>

                    {questionsError ? (
                        <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700 ring-1 ring-red-100">
                            {questionsError}
                        </div>
                    ) : null}

                    {isQuestionsLoading ? (
                        <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">
                            Loading questions...
                        </div>
                    ) : questions.length === 0 ? (
                        <div className="mt-5 rounded-2xl bg-blue-50 p-5 text-sm text-blue-900 ring-1 ring-blue-100">
                            {questionCategoryFilter ||
                            questionSourceFilter !== "all" ||
                            questionEditorialFilter !== "all" ||
                            showInactiveQuestions
                                ? "No questions match the current filters."
                                : "No questions found yet. Use Add Question to create your first MCQ."}
                        </div>
                    ) : filteredQuestions.length === 0 ? (
                        <div className="mt-5 rounded-2xl bg-violet-50 p-5 text-sm text-violet-900 ring-1 ring-violet-100">
                            No imported questions match the current Editorial QA filter.
                        </div>
                    ) : (
                        <div className="mt-5 grid gap-4">
                            {editorialQueueQuestions.map((question) => {
                                const group = getQuestionGroupSummary(
                                    question.questionGroupId
                                );
                                const category = getCategorySummary(
                                    question.categoryId
                                );
                                const importedQuestion =
                                    isImportedQuestion(question);
                                const editoriallyApproved =
                                    isQuestionEditoriallyApproved(question);
                                const hasRevisionTimestamp = Boolean(
                                    question.updatedAt &&
                                        !Number.isNaN(
                                            new Date(question.updatedAt).getTime()
                                        )
                                );
                                const canApproveEditorial =
                                    importedQuestion &&
                                    !editoriallyApproved &&
                                    hasRevisionTimestamp &&
                                    (adminRole === "super_admin" ||
                                        adminRole === "tenant_admin");
                                const isEditorialReviewOpen =
                                    editorialReviewQuestionId === question._id;
                                const editorialStatusLabel = editoriallyApproved
                                    ? "Editorially Approved"
                                    : "Editorial Review Required";

                                return (
                                    <article
                                        key={question._id}
                                        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                                    >
                                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                            <div>
                                                <div className="flex flex-wrap gap-2">
                                                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                                        {question.questionType ||
                                                            "mcq"}
                                                    </span>
                                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                                        {question.sourceType ||
                                                            "original"}
                                                    </span>
                                                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                                                        {question.difficulty ||
                                                            "medium"}
                                                    </span>
                                                    <span
                                                        className={
                                                            question.isActive === false
                                                                ? "rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700"
                                                                : "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                                                        }
                                                    >
                                                        {question.isActive === false
                                                            ? "Inactive"
                                                            : "Active"}
                                                    </span>

                                                    {importedQuestion ? (
                                                        <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                                                            {question.externalQuestionKey}
                                                        </span>
                                                    ) : null}

                                                    {importedQuestion ? (
                                                        <span
                                                            className={
                                                                editoriallyApproved
                                                                    ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                                                                    : "rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700"
                                                            }
                                                        >
                                                            {editorialStatusLabel}
                                                        </span>
                                                    ) : null}
                                                </div>

                                                <h3 className="mt-3 text-lg font-bold text-slate-950">
                                                    {question.questionTextEn ||
                                                        question.questionTextHi ||
                                                        "Untitled question"}
                                                </h3>

                                                {question.questionTextHi &&
                                                question.questionTextEn ? (
                                                    <p className="mt-2 text-sm leading-6 text-slate-600">
                                                        {question.questionTextHi}
                                                    </p>
                                                ) : null}
                                            </div>

                                            <div className="grid min-w-[170px] gap-3">
                                                <div className="rounded-2xl bg-slate-50 p-4 text-sm ring-1 ring-slate-200">
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                        Correct Option
                                                    </p>
                                                    <p className="mt-1 text-xl font-bold">
                                                        {question.correctOptionId ||
                                                            "-"}
                                                    </p>
                                                    <p className="mt-2 text-xs text-slate-500">
                                                        +{question.marks ?? 1} / -
                                                        {question.negativeMarks ?? 0}
                                                    </p>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        startEditQuestion(question)
                                                    }
                                                    className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                                                >
                                                    Edit
                                                </button>

                                                {canApproveEditorial ? (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            openEditorialReview(
                                                                question._id
                                                            )
                                                        }
                                                        className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                                                    >
                                                        Review & Approve
                                                    </button>
                                                ) : null}

                                                {question.isActive === false ? (
                                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-center text-sm font-semibold text-slate-500">
                                                        Disabled
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleDisableQuestion(
                                                                question
                                                            )
                                                        }
                                                        disabled={
                                                            disablingQuestionId ===
                                                            question._id
                                                        }
                                                        className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                                    >
                                                        {disablingQuestionId ===
                                                        question._id
                                                            ? "Disabling..."
                                                            : "Disable"}
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
                                            <p>
                                                <span className="font-semibold text-slate-800">
                                                    Subject:
                                                </span>{" "}
                                                {question.subject || "-"}
                                            </p>
                                            <p>
                                                <span className="font-semibold text-slate-800">
                                                    Topic:
                                                </span>{" "}
                                                {question.topic || "-"}
                                            </p>
                                            <p>
                                                <span className="font-semibold text-slate-800">
                                                    Category:
                                                </span>{" "}
                                                {category?.name || "-"}
                                            </p>
                                        </div>

                                        {group ? (
                                            <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm text-blue-900 ring-1 ring-blue-100">
                                                <p className="font-semibold">
                                                    Linked Question Group
                                                </p>
                                                <p className="mt-1">
                                                    {group.title || group.slug}{" "}
                                                    - {group.groupType || "group"} -
                                                    {" "}
                                                    {group.displayMode || "auto"} -
                                                    {" "}
                                                    Order{" "}
                                                    {question.groupQuestionOrder ??
                                                        "-"}
                                                </p>
                                            </div>
                                        ) : null}

                                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                                            {(question.options || []).map(
                                                (option) => {
                                                    const isCorrect =
                                                        option.optionId ===
                                                        question.correctOptionId;

                                                    return (
                                                        <div
                                                            key={option.optionId}
                                                            className={
                                                                "rounded-2xl border p-4 text-sm " +
                                                                (isCorrect
                                                                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                                                                    : "border-slate-200 bg-slate-50 text-slate-700")
                                                            }
                                                        >
                                                            <p className="font-bold">
                                                                {option.optionId}
                                                                {isCorrect
                                                                    ? " - Correct"
                                                                    : ""}
                                                            </p>
                                                            {option.textEn ? (
                                                                <div className="mt-2">
                                                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                                                        Option English
                                                                    </p>
                                                                    <p className="mt-1">
                                                                        {option.textEn}
                                                                    </p>
                                                                </div>
                                                            ) : null}

                                                            {option.textHi ? (
                                                                <div className="mt-3 border-t border-slate-200 pt-3">
                                                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                                                        Option Hindi
                                                                    </p>
                                                                    <p className="mt-1">
                                                                        {option.textHi}
                                                                    </p>
                                                                </div>
                                                            ) : null}

                                                            {!option.textEn &&
                                                            !option.textHi ? (
                                                                <p className="mt-2">
                                                                    {option.imageUrl || "-"}
                                                                </p>
                                                            ) : null}
                                                        </div>
                                                    );
                                                }
                                            )}
                                        </div>

                                        {question.explanationEn ||
                                        question.explanationHi ? (
                                            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700 ring-1 ring-slate-200">
                                                <p className="font-semibold text-slate-900">
                                                    Explanation
                                                </p>

                                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                                    {question.explanationEn ? (
                                                        <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                                Explanation English
                                                            </p>
                                                            <p className="mt-1">
                                                                {question.explanationEn}
                                                            </p>
                                                        </div>
                                                    ) : null}

                                                    {question.explanationHi ? (
                                                        <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                                Explanation Hindi
                                                            </p>
                                                            <p className="mt-1">
                                                                {question.explanationHi}
                                                            </p>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>
                                        ) : null}

                                        {importedQuestion ? (
                                            <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
                                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                    <div>
                                                        <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                                                            Editorial QA
                                                        </p>
                                                        <p className="mt-1 text-base font-bold text-slate-950">
                                                            {editorialStatusLabel}
                                                        </p>
                                                        <p className="mt-1 break-all text-xs text-slate-600">
                                                            Import key: {question.externalQuestionKey}
                                                        </p>
                                                    </div>

                                                    <div className="rounded-xl bg-white px-3 py-2 text-xs text-slate-600 ring-1 ring-violet-100">
                                                        <span className="font-semibold text-slate-800">
                                                            Current revision:
                                                        </span>{" "}
                                                        {formatEditorialTimestamp(
                                                            question.updatedAt
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                                    <div className="rounded-xl bg-white p-3 text-sm ring-1 ring-violet-100">
                                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                            Answer verification
                                                        </p>
                                                        <p className="mt-1 leading-6 text-slate-700">
                                                            {question.importMetadata
                                                                ?.answerVerifiedBy ||
                                                                "Not recorded"}
                                                        </p>
                                                    </div>

                                                    <div className="rounded-xl bg-white p-3 text-sm ring-1 ring-violet-100">
                                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                            Hindi / English verification
                                                        </p>
                                                        <p className="mt-1 leading-6 text-slate-700">
                                                            {question.importMetadata
                                                                ?.languageVerifiedBy ||
                                                                "Not recorded"}
                                                        </p>
                                                    </div>
                                                </div>

                                                {editoriallyApproved ? (
                                                    <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 ring-1 ring-emerald-100">
                                                        <span className="font-semibold">
                                                            Approved:
                                                        </span>{" "}
                                                        {formatEditorialTimestamp(
                                                            question.importMetadata?.approvedAt
                                                        )}
                                                    </div>
                                                ) : !hasRevisionTimestamp ? (
                                                    <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 ring-1 ring-red-100">
                                                        Revision timestamp is unavailable.
                                                        Refresh the Question Bank before final
                                                        approval.
                                                    </div>
                                                ) : null}

                                                {isEditorialReviewOpen ? (
                                                    <div
                                                        id={`editorial-review-${question._id}`}
                                                        className="mt-4 rounded-2xl border border-emerald-200 bg-white p-4"
                                                    >
                                                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                                                            Human editorial review
                                                        </p>
                                                        <p className="mt-2 text-sm leading-6 text-slate-700">
                                                            Review the question wording, all
                                                            options, correct answer, explanation,
                                                            and Hindi / English quality shown on
                                                            this card. No approval is submitted
                                                            from this panel yet.
                                                        </p>

                                                        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200">
                                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                                Revision being approved
                                                            </p>
                                                            <p className="mt-1 font-semibold text-slate-900">
                                                                {formatEditorialTimestamp(
                                                                    question.updatedAt
                                                                )}
                                                            </p>
                                                        </div>

                                                        <div className="mt-4 grid gap-3">
                                                            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={
                                                                        editorialAnswerAttested
                                                                    }
                                                                    onChange={(event) =>
                                                                        setEditorialAnswerAttested(
                                                                            event.target.checked
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        approvingQuestionId ===
                                                                        question._id
                                                                    }
                                                                    className="mt-1 h-4 w-4 accent-emerald-600"
                                                                />
                                                                <span className="text-sm leading-6 text-slate-700">
                                                                    I verified the correct answer,
                                                                    all options, and the explanation
                                                                    for this exact Question revision.
                                                                </span>
                                                            </label>

                                                            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={
                                                                        editorialLanguageAttested
                                                                    }
                                                                    onChange={(event) =>
                                                                        setEditorialLanguageAttested(
                                                                            event.target.checked
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        approvingQuestionId ===
                                                                        question._id
                                                                    }
                                                                    className="mt-1 h-4 w-4 accent-emerald-600"
                                                                />
                                                                <span className="text-sm leading-6 text-slate-700">
                                                                    I verified the Hindi / English
                                                                    wording, meaning, and bilingual
                                                                    quality for this exact revision.
                                                                </span>
                                                            </label>
                                                        </div>

                                                        <div className="mt-4 flex flex-wrap gap-3">
                                                            <button
                                                                type="button"
                                                                onClick={closeEditorialReview}
                                                                disabled={
                                                                    approvingQuestionId ===
                                                                    question._id
                                                                }
                                                                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                                            >
                                                                Close Review
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    void handleEditorialApproval(
                                                                        question
                                                                    )
                                                                }
                                                                disabled={
                                                                    !editorialAnswerAttested ||
                                                                    !editorialLanguageAttested ||
                                                                    approvingQuestionId ===
                                                                        question._id
                                                                }
                                                                className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                                                            >
                                                                {approvingQuestionId ===
                                                                question._id
                                                                    ? "Approving..."
                                                                    : "Approve Reviewed Revision"}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : null}
                                            </div>
                                        ) : null}
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
