"use client";

import Link from "next/link";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

type AttemptPayload = {
    resumed: boolean;
    serverTime: string;
    attempt: {
        _id: string;
        attemptNumber: number;
        status: string;
        startedAt?: string;
        expiresAt?: string;
        totalDurationSeconds?: number;
        timeSpentSeconds?: number;
    };
    test: {
        _id: string;
        mockTestId: string;
        versionNumber: number;
        title: string;
        slug: string;
        description?: string;
        testType: string;
        accessType: string;
        instructionsEn?: string;
        instructionsHi?: string;
        examPatternSnapshot: {
            name: string;
            examType: string;
            totalDurationMinutes: number;
            allowSectionSwitching?: boolean;
            allowQuestionNavigation?: boolean;
            allowLanguageSwitching?: boolean;
        };
        sections: TestSection[];
        settings: {
            allowResume?: boolean;
            allowQuestionNavigation?: boolean;
            allowSectionSwitching?: boolean;
            allowLanguageSwitching?: boolean;
            shuffleQuestions?: boolean;
            shuffleOptions?: boolean;
            interfaceMode?: string;
            solutionVisibility?: string;
        };
    };
};

type ContentBlock = {
    blockType: string;
    textEn?: string;
    textHi?: string;
    latex?: string;
    imageUrl?: string;
    altText?: string;
    captionEn?: string;
    captionHi?: string;
    order: number;
    isVisible?: boolean;
};

type QuestionGroup = {
    questionGroupId: string;
    title: string;
    groupType: string;
    subject?: string;
    topic?: string;
    instructionEn?: string;
    instructionHi?: string;
    passageEn?: string;
    passageHi?: string;
    contentBlocks?: ContentBlock[];
    displayMode?: string;
};

type TestQuestion = {
    _id: string;
    questionId: string;
    questionGroupId?: string;
    groupQuestionOrder?: number;
    questionType: string;
    subject?: string;
    topic?: string;
    subTopic?: string;
    questionTextEn?: string;
    questionTextHi?: string;
    questionImageUrl?: string;
    options: {
        optionId: string;
        textEn?: string;
        textHi?: string;
        imageUrl?: string;
    }[];
    marks: number;
    negativeMarks: number;
    difficulty?: string;
    order: number;
};

type TestSection = {
    sectionSlug: string;
    name: string;
    sectionType: string;
    durationMinutes: number;
    questionCount: number;
    marksPerQuestion: number;
    negativeMarks: number;
    order: number;
    questionGroups?: QuestionGroup[];
    questions: TestQuestion[];
};

type SaveAnswerResponse = {
    success: boolean;
    message: string;
    data?: {
        answer?: {
            questionSnapshotId: string;
            selectedOptionId?: string | null;
            markedForReview?: boolean;
            status?: string;
            timeSpentSeconds?: number;
        };
        attempt?: {
            timeSpentSeconds?: number;
            lastActivityAt?: string;
        };
    };
};

type SubmitAttemptResponse = {
    success: boolean;
    message: string;
    data?: {
        resultAvailable?: boolean;
        attempt?: {
            _id: string;
            attemptNumber: number;
            status: string;
            submittedAt?: string;
            scoreSummary?: {
                totalQuestions?: number;
                attempted?: number;
                correct?: number;
                wrong?: number;
                skipped?: number;
                score?: number;
                maxScore?: number;
                percentage?: number;
                accuracy?: number;
            };
        };
    };
};

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const STUDENT_TOKEN_STORAGE_KEY = "pravixoStudentToken";
const ACTIVE_ATTEMPT_PAYLOAD_STORAGE_KEY = "pravixoActiveAttemptPayload";

const subscribeToPayloadStorage = (onStoreChange: () => void) => {
    if (typeof window === "undefined") {
        return () => {};
    }

    window.addEventListener("storage", onStoreChange);

    return () => {
        window.removeEventListener("storage", onStoreChange);
    };
};

const getPayloadSnapshot = () => {
    if (typeof window === "undefined") {
        return "";
    }

    return (
        window.localStorage.getItem(ACTIVE_ATTEMPT_PAYLOAD_STORAGE_KEY) || ""
    );
};

const getServerPayloadSnapshot = () => {
    return "";
};

const parsePayloadSnapshot = (payloadSnapshot: string) => {
    if (!payloadSnapshot) {
        return null;
    }

    try {
        return JSON.parse(payloadSnapshot) as AttemptPayload;
    } catch {
        return null;
    }
};

const getBestText = (primary?: string, fallback?: string) => {
    return primary || fallback || "";
};

const formatDuration = (totalSeconds: number) => {
    const safeSeconds = Math.max(totalSeconds, 0);
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
        2,
        "0"
    )}`;
};

const getPaletteClassName = ({
    isCurrent,
    isAnswered,
    isMarkedForReview,
}: {
    isCurrent: boolean;
    isAnswered: boolean;
    isMarkedForReview: boolean;
}) => {
    if (isCurrent) {
        return "bg-blue-700 text-white ring-2 ring-blue-200";
    }

    if (isMarkedForReview) {
        return "bg-amber-300 text-slate-950";
    }

    if (isAnswered) {
        return "bg-emerald-600 text-white";
    }

    return "bg-white text-slate-700 ring-1 ring-slate-300";
};

const getInterfaceMessageClassName = (message: string) => {
    const lowerMessage = message.toLowerCase();

    if (
        lowerMessage.includes("unable") ||
        lowerMessage.includes("not found") ||
        lowerMessage.includes("not authorized") ||
        lowerMessage.includes("expired") ||
        lowerMessage.includes("no longer active") ||
        lowerMessage.includes("only in-progress") ||
        lowerMessage.includes("time is over")
    ) {
        return "border-red-200 bg-red-50 text-red-700";
    }

    if (
        lowerMessage.includes("saved") ||
        lowerMessage.includes("marked") ||
        lowerMessage.includes("cleared")
    ) {
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }

    return "border-blue-200 bg-white text-blue-700";
};
export default function StudentAttemptPage() {
    const pathname = usePathname();
    const payloadSnapshot = useSyncExternalStore(
        subscribeToPayloadStorage,
        getPayloadSnapshot,
        getServerPayloadSnapshot
    );
    const payload = useMemo(
        () => parsePayloadSnapshot(payloadSnapshot),
        [payloadSnapshot]
    );
    const attemptIdFromPath = useMemo(() => {
        const parts = pathname.split("/").filter(Boolean);

        return parts[parts.length - 1] || "";
    }, [pathname]);
    const [now, setNow] = useState(() => Date.now());
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswers, setSelectedAnswers] = useState<
        Record<string, string>
    >({});
    const [markedForReview, setMarkedForReview] = useState<
        Record<string, boolean>
    >({});
    const [interfaceMessage, setInterfaceMessage] = useState("");
    const [isSavingAnswer, setIsSavingAnswer] = useState(false);
    const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
    const [isSubmittingAttempt, setIsSubmittingAttempt] = useState(false);
    const [submitSummaryMessage, setSubmitSummaryMessage] = useState("");
    const [submittedAtMs, setSubmittedAtMs] = useState<number | null>(null);
    const questionStartedAtRef = useRef(0);
    const [lastSavedAtByQuestion, setLastSavedAtByQuestion] = useState<
        Record<string, string>
    >({});

    useEffect(() => {
        if (submittedAtMs !== null || submitSummaryMessage) {
            return;
        }

        const timerId = window.setInterval(() => {
            setNow(Date.now());
        }, 1000);

        return () => {
            window.clearInterval(timerId);
        };
    }, [submittedAtMs, submitSummaryMessage]);

    useEffect(() => {
        questionStartedAtRef.current = Date.now();
    }, [currentQuestionIndex]);


    useEffect(() => {
        if (!interfaceMessage) {
            return;
        }

        const autoDismissInterfaceMessageId = window.setTimeout(() => {
            setInterfaceMessage("");
        }, 3000);

        return () => {
            window.clearTimeout(autoDismissInterfaceMessageId);
        };
    }, [interfaceMessage]);

    const section = payload?.test.sections?.[0] || null;

    const questions = useMemo(() => {
        return [...(section?.questions || [])].sort(
            (firstQuestion, secondQuestion) =>
                firstQuestion.order - secondQuestion.order
        );
    }, [section]);

    const currentQuestion = questions[currentQuestionIndex] || null;
    const currentQuestionNumber = currentQuestionIndex + 1;

    const currentQuestionGroup = useMemo(() => {
        if (!section || !currentQuestion?.questionGroupId) {
            return null;
        }

        return (
            section.questionGroups?.find((questionGroup) => {
                return (
                    questionGroup.questionGroupId ===
                    currentQuestion.questionGroupId
                );
            }) || null
        );
    }, [currentQuestion, section]);

    const remainingSeconds = useMemo(() => {
        if (!payload?.attempt.expiresAt) {
            return payload?.attempt.totalDurationSeconds || 0;
        }

        return Math.floor(
            (new Date(payload.attempt.expiresAt).getTime() - now) / 1000
        );
    }, [now, payload]);

    const answeredCount = questions.filter((question) => {
        return Boolean(selectedAnswers[question._id]);
    }).length;

    const markedCount = questions.filter((question) => {
        return Boolean(markedForReview[question._id]);
    }).length;

    const selectedOptionId = currentQuestion
        ? selectedAnswers[currentQuestion._id] || null
        : null;

    const isAttemptLocked =
        !payload ||
        Boolean(submitSummaryMessage) ||
        remainingSeconds <= 0 ||
        payload.attempt.status !== "in_progress";

    const handleSelectOption = (optionId: string) => {
        if (!currentQuestion) {
            return;
        }

        setSelectedAnswers((previousAnswers) => ({
            ...previousAnswers,
            [currentQuestion._id]: optionId,
        }));

        setInterfaceMessage("");
    };

    const getStudentToken = () => {
        if (typeof window === "undefined") {
            return "";
        }

        return window.localStorage.getItem(STUDENT_TOKEN_STORAGE_KEY) || "";
    };

    const getCurrentQuestionTimeSpentSeconds = () => {
        return Math.max(
            1,
            Math.floor((Date.now() - questionStartedAtRef.current) / 1000)
        );
    };

    const saveCurrentAnswer = async ({
        selectedOptionIdOverride,
        markedForReviewOverride,
        moveNext,
        successMessage,
    }: {
        selectedOptionIdOverride?: string | null;
        markedForReviewOverride?: boolean;
        moveNext?: boolean;
        successMessage?: string;
    }) => {
        if (!payload || !currentQuestion) {
            return false;
        }

        if (isAttemptLocked) {
            setInterfaceMessage(
                "Time is over. This attempt can no longer be updated."
            );
            return false;
        }

        const token = getStudentToken().trim();

        if (!token) {
            setInterfaceMessage(
                "Student token not found. Please go back to mock tests and load the test again."
            );
            return false;
        }

        const selectedOptionToSave =
            selectedOptionIdOverride !== undefined
                ? selectedOptionIdOverride
                : selectedAnswers[currentQuestion._id] || null;

        const markedForReviewToSave =
            markedForReviewOverride !== undefined
                ? markedForReviewOverride
                : Boolean(markedForReview[currentQuestion._id]);

        setIsSavingAnswer(true);
        setInterfaceMessage("");

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/student/attempts/${payload.attempt._id}/answer`,
                {
                    method: "PATCH",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        questionSnapshotId: currentQuestion._id,
                        selectedOptionId: selectedOptionToSave,
                        markedForReview: markedForReviewToSave,
                        confidenceLevel: "not_marked",
                        timeSpentSeconds: getCurrentQuestionTimeSpentSeconds(),
                    }),
                }
            );

            const result = (await response.json()) as SaveAnswerResponse;

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to save answer.");
            }

            setLastSavedAtByQuestion((previousSavedAt) => ({
                ...previousSavedAt,
                [currentQuestion._id]: new Date().toLocaleTimeString(),
            }));

            if (moveNext && currentQuestionIndex < questions.length - 1) {
                questionStartedAtRef.current = Date.now();
                setCurrentQuestionIndex((previousIndex) => previousIndex + 1);
            }

            setInterfaceMessage(
                successMessage || result.message || "Answer saved successfully."
            );

            return true;
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Unable to save answer.";

            setInterfaceMessage(
                message === "Only in-progress attempts can be updated"
                    ? "This attempt is no longer active. Please return to mock tests and start/resume again."
                    : message
            );
            return false;
        } finally {
            setIsSavingAnswer(false);
        }
    };

    const handleClearResponse = () => {
        if (!currentQuestion || isSavingAnswer) {
            return;
        }

        setSelectedAnswers((previousAnswers) => {
            const updatedAnswers = { ...previousAnswers };
            delete updatedAnswers[currentQuestion._id];
            return updatedAnswers;
        });

        void saveCurrentAnswer({
            selectedOptionIdOverride: null,
            successMessage: "Response cleared and saved.",
        });
    };

    const handleMarkForReview = () => {
        if (!currentQuestion || isSavingAnswer) {
            return;
        }

        const nextMarkedValue = !markedForReview[currentQuestion._id];

        setMarkedForReview((previousMarked) => ({
            ...previousMarked,
            [currentQuestion._id]: nextMarkedValue,
        }));

        void saveCurrentAnswer({
            markedForReviewOverride: nextMarkedValue,
            successMessage: nextMarkedValue
                ? "Question marked for review and saved."
                : "Review mark removed and saved.",
        });
    };

    const handleSaveAndNext = () => {
        if (isSavingAnswer) {
            return;
        }

        void saveCurrentAnswer({
            moveNext: true,
            successMessage:
                currentQuestionIndex < questions.length - 1
                    ? "Answer saved. Moving to next question."
                    : "Answer saved. You are on the last question.",
        });
    };

    const submitAttemptFromFrontend = async () => {
        if (!payload || isSubmittingAttempt || submitSummaryMessage) {
            return;
        }

        const token = getStudentToken().trim();

        if (!token) {
            setInterfaceMessage(
                "Student token not found. Please go back to mock tests and load the test again."
            );
            return;
        }

        setIsSubmittingAttempt(true);
        setInterfaceMessage("Saving current answer before final submit.");

        try {
            const currentAnswerSaved = await saveCurrentAnswer({
                successMessage: "Current answer saved before final submit.",
            });

            if (!currentAnswerSaved) {
                return;
            }

            const response = await fetch(
                `${API_BASE_URL}/api/student/attempts/${payload.attempt._id}/submit`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const result = (await response.json()) as SubmitAttemptResponse;

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to submit attempt.");
            }

            const submittedAttemptNumber =
                result.data?.attempt?.attemptNumber || payload.attempt.attemptNumber;

            setSubmitSummaryMessage(
                `Attempt #${submittedAttemptNumber} submitted successfully. You can now view result and review.`
            );
            setSubmittedAtMs(Date.now());
            setIsSubmitModalOpen(false);
            setInterfaceMessage("Test submitted successfully.");
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Unable to submit attempt.";

            setInterfaceMessage(message);
        } finally {
            setIsSubmittingAttempt(false);
        }
    };

    if (!payload) {
        return (
            <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950">
                <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
                    <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                        PravixoEduTech Test Interface
                    </p>

                    <h1 className="mt-2 text-2xl font-bold">
                        Attempt data not found
                    </h1>

                    <p className="mt-3 text-sm leading-6 text-slate-600">
                        Please go back to the mock test listing page and start or
                        resume the test again.
                    </p>

                    <a
                        href="/student/mock-tests"
                        className="mt-6 inline-flex rounded-2xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white"
                    >
                        Go to Mock Tests
                    </a>
                </div>
            </main>
        );
    }

    const isAttemptMismatch = attemptIdFromPath !== payload.attempt._id;

    return (
        <main className="min-h-screen bg-slate-100 text-slate-950">
            {interfaceMessage ? (
                <div
                    role="status"
                    aria-live="polite"
                    className={`fixed left-4 right-4 top-24 z-50 mx-auto max-w-xl rounded-2xl border px-4 py-3 text-sm font-semibold shadow-lg lg:left-auto lg:right-6 lg:mx-0 lg:w-[420px] ${getInterfaceMessageClassName(interfaceMessage)}`}
                >
                    {interfaceMessage}
                </div>
            ) : null}

            {isSubmitModalOpen ? (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 px-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl ring-1 ring-slate-200">
                        <p className="text-sm font-semibold uppercase tracking-wide text-red-600">
                            Confirm Submit
                        </p>

                        <h2 className="mt-2 text-xl font-bold text-slate-950">
                            Submit this test?
                        </h2>

                        <p className="mt-3 text-sm leading-6 text-slate-600">
                            Once submitted, answers cannot be changed. You can view result/review after submission according to test settings.
                        </p>

                        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={() => setIsSubmitModalOpen(false)}
                                disabled={isSubmittingAttempt}
                                className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                onClick={() => void submitAttemptFromFrontend()}
                                disabled={isSubmittingAttempt}
                                className="rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                            >
                                {isSubmittingAttempt ? "Submitting..." : "Yes, Submit"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
                <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                            Attempt #{payload.attempt.attemptNumber}
                        </p>

                        <h1 className="text-lg font-bold md:text-xl">
                            {payload.test.title}
                        </h1>

                        <p className="text-xs text-slate-500">
                            {payload.test.examPatternSnapshot.name} • Version{" "}
                            {payload.test.versionNumber} • {section?.name || "Section"}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-center">
                            <p className="text-xs font-semibold uppercase text-slate-500">
                                Time Left
                            </p>

                            <p className="font-mono text-xl font-bold text-slate-950">
                                {formatDuration(remainingSeconds)}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsSubmitModalOpen(true)}
                            disabled={isSubmittingAttempt || Boolean(submitSummaryMessage)}
                            className="rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                        >
                            {isSubmittingAttempt
                                ? "Submitting..."
                                : submitSummaryMessage
                                  ? "Submitted"
                                  : "Submit Test"}
                        </button>
                    </div>
                </div>
            </header>

            <div className="mx-auto grid max-w-7xl gap-4 px-3 py-4 lg:grid-cols-[minmax(0,1fr)_240px]">
                <section className="space-y-5">
                    {submitSummaryMessage ? (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                            <p className="font-semibold">
                                {submitSummaryMessage}
                            </p>

                            <div className="mt-3 flex flex-wrap gap-3">
                                <Link
                                    href={`/student/attempts/${payload.attempt._id}/result`}
                                    className="rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
                                >
                                    View Result
                                </Link>

                                <Link
                                    href={`/student/attempts/${payload.attempt._id}/review`}
                                    className="rounded-2xl border border-emerald-300 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                                >
                                    View Review
                                </Link>
                            </div>
                        </div>
                    ) : null}
                    {isAttemptMismatch ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                            Attempt URL and stored attempt do not match. Please
                            restart from the mock test listing page if anything
                            looks incorrect.
                        </div>
                    ) : null}



                    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Test Instructions
                        </p>

                        <p className="mt-2 text-sm leading-6 text-slate-700">
                            {getBestText(
                                payload.test.instructionsEn,
                                payload.test.instructionsHi
                            ) || "Read all instructions carefully before answering."}
                        </p>
                    </div>

                    {currentQuestionGroup ? (
                        <div className="sticky top-20 z-10 max-h-[38vh] overflow-y-auto rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                    {currentQuestionGroup.groupType}
                                </span>

                                {currentQuestionGroup.topic ? (
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                        {currentQuestionGroup.topic}
                                    </span>
                                ) : null}
                            </div>

                            <h2 className="text-base font-bold">
                                {currentQuestionGroup.title}
                            </h2>

                            {getBestText(
                                currentQuestionGroup.instructionEn,
                                currentQuestionGroup.instructionHi
                            ) ? (
                                <p className="mt-3 text-sm leading-6 text-slate-700">
                                    {getBestText(
                                        currentQuestionGroup.instructionEn,
                                        currentQuestionGroup.instructionHi
                                    )}
                                </p>
                            ) : null}

                            {getBestText(
                                currentQuestionGroup.passageEn,
                                currentQuestionGroup.passageHi
                            ) ? (
                                <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                                    {getBestText(
                                        currentQuestionGroup.passageEn,
                                        currentQuestionGroup.passageHi
                                    )}
                                </p>
                            ) : null}

                            {currentQuestionGroup.contentBlocks
                                ?.filter((block) => block.isVisible !== false)
                                .sort(
                                    (firstBlock, secondBlock) =>
                                        firstBlock.order - secondBlock.order
                                )
                                .map((block) => {
                                    const blockText = getBestText(
                                        block.textEn,
                                        block.textHi
                                    );

                                    if (!blockText && !block.latex) {
                                        return null;
                                    }

                                    return (
                                        <div
                                            key={`${block.blockType}-${block.order}`}
                                            className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700"
                                        >
                                            {blockText || block.latex}
                                        </div>
                                    );
                                })}
                        </div>
                    ) : null}

                    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                        <div className="mb-4 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                                Question {currentQuestionNumber}
                            </span>

                            {currentQuestion?.subject ? (
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                    {currentQuestion.subject}
                                </span>
                            ) : null}

                            {currentQuestion?.topic ? (
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                    {currentQuestion.topic}
                                </span>
                            ) : null}

                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                                +{currentQuestion?.marks || 0}
                            </span>

                            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                                -{currentQuestion?.negativeMarks || 0}
                            </span>
                        </div>

                        <h2 className="text-base font-semibold leading-7 text-slate-950 md:text-lg">
                            {getBestText(
                                currentQuestion?.questionTextEn,
                                currentQuestion?.questionTextHi
                            ) || "Question text not available."}
                        </h2>

                        {currentQuestion &&
                        lastSavedAtByQuestion[currentQuestion._id] ? (
                            <p className="mt-3 text-xs font-semibold text-emerald-700">
                                Saved at{" "}
                                {lastSavedAtByQuestion[currentQuestion._id]}
                            </p>
                        ) : null}

                        <div className="mt-6 space-y-3">
                            {currentQuestion?.options.map((option) => {
                                const isSelected =
                                    selectedOptionId === option.optionId;

                                return (
                                    <button
                                        key={option.optionId}
                                        type="button"
                                        onClick={() =>
                                            handleSelectOption(option.optionId)
                                        }
                                        className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left text-sm transition ${
                                            isSelected
                                                ? "border-blue-600 bg-blue-50 ring-2 ring-blue-100"
                                                : "border-slate-200 bg-white hover:border-blue-300"
                                        }`}
                                    >
                                        <span
                                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                                isSelected
                                                    ? "bg-blue-700 text-white"
                                                    : "bg-slate-100 text-slate-700"
                                            }`}
                                        >
                                            {option.optionId}
                                        </span>

                                        <span className="pt-1 leading-6">
                                            {getBestText(
                                                option.textEn,
                                                option.textHi
                                            ) || "Option text not available."}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-6 flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={handleSaveAndNext}
                                disabled={isSavingAnswer || isAttemptLocked}
                                className="rounded-2xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                            >
                                {isSavingAnswer ? "Saving..." : "Save & Next"}
                            </button>

                            <button
                                type="button"
                                onClick={handleClearResponse}
                                disabled={isSavingAnswer || isAttemptLocked}
                                className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                            >
                                Clear Response
                            </button>

                            <button
                                type="button"
                                onClick={handleMarkForReview}
                                disabled={isSavingAnswer || isAttemptLocked}
                                className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                            >
                                Mark for Review
                            </button>
                        </div>
                    </div>
                </section>

                <aside className="lg:sticky lg:top-24 lg:self-start">
                    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                        <h2 className="text-base font-bold">
                            Question Palette
                        </h2>

                        <p className="mt-1 text-xs text-slate-500">
                            Section: {section?.name || "Not available"}
                        </p>

                        <div className="mt-3 grid grid-cols-5 gap-1.5">
                            {questions.map((question, index) => {
                                const questionNumber = index + 1;
                                const isCurrent =
                                    index === currentQuestionIndex;
                                const isAnswered = Boolean(
                                    selectedAnswers[question._id]
                                );
                                const isMarkedForReview = Boolean(
                                    markedForReview[question._id]
                                );

                                return (
                                    <button
                                        key={question._id}
                                        type="button"
                                        onClick={() => {
                                            questionStartedAtRef.current = Date.now();
                                            setCurrentQuestionIndex(index);
                                        }}
                                        className={`h-8 rounded-lg text-sm font-bold ${getPaletteClassName(
                                            {
                                                isCurrent,
                                                isAnswered,
                                                isMarkedForReview,
                                            }
                                        )}`}
                                    >
                                        {questionNumber}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                            <div className="rounded-xl bg-emerald-50 p-2">
                                <p className="text-xs font-semibold text-emerald-700">
                                    Answered
                                </p>
                                <p className="mt-1 text-lg font-bold">
                                    {answeredCount}
                                </p>
                            </div>

                            <div className="rounded-2xl bg-amber-50 p-2">
                                <p className="text-xs font-semibold text-amber-700">
                                    Marked
                                </p>
                                <p className="mt-1 text-lg font-bold">
                                    {markedCount}
                                </p>
                            </div>
                        </div>

                        <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                            <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full bg-blue-700" />
                                Current question
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full bg-emerald-600" />
                                Answered
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full bg-amber-300 ring-1 ring-amber-400" />
                                Marked for review
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full bg-white ring-1 ring-slate-300" />
                                Not answered
                            </div>
                        </div>

                        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
                            <p className="font-semibold">
                                Attempt Status
                            </p>

                            <p className="mt-1 text-slate-600">
                                {submitSummaryMessage ? "submitted" : payload.attempt.status}
                            </p>

                            <p className="mt-3 font-semibold">
                                Section Duration
                            </p>

                            <p className="mt-1 text-slate-600">
                                {section?.durationMinutes || "-"} minutes
                            </p>
                        </div>
                    </div>
                </aside>
            </div>
        </main>
    );
}
