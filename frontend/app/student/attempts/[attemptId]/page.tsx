"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
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
        return "bg-purple-600 text-white";
    }

    if (isAnswered) {
        return "bg-emerald-600 text-white";
    }

    return "bg-white text-slate-700 ring-1 ring-slate-300";
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

    useEffect(() => {
        const timerId = window.setInterval(() => {
            setNow(Date.now());
        }, 1000);

        return () => {
            window.clearInterval(timerId);
        };
    }, []);

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

    const handleClearResponse = () => {
        if (!currentQuestion) {
            return;
        }

        setSelectedAnswers((previousAnswers) => {
            const updatedAnswers = { ...previousAnswers };
            delete updatedAnswers[currentQuestion._id];
            return updatedAnswers;
        });

        setInterfaceMessage("Response cleared for current question.");
    };

    const handleMarkForReview = () => {
        if (!currentQuestion) {
            return;
        }

        setMarkedForReview((previousMarked) => ({
            ...previousMarked,
            [currentQuestion._id]: !previousMarked[currentQuestion._id],
        }));

        setInterfaceMessage("Mark for review is locally updated. Backend save will be connected in T-34B.");
    };

    const handleSaveAndNext = () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex((previousIndex) => previousIndex + 1);
            setInterfaceMessage("Answer selection is locally saved. Backend save will be connected in T-34B.");
            return;
        }

        setInterfaceMessage("You are on the last question. Submit flow will be connected in T-35.");
    };

    if (!payload) {
        return (
            <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950">
                <div className="mx-auto max-w-3xl rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
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
                        className="mt-6 inline-flex rounded-2xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white"
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
                            onClick={() =>
                                setInterfaceMessage(
                                    "Submit confirmation and submit API will be connected in T-35."
                                )
                            }
                            className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-semibold text-white"
                        >
                            Submit Test
                        </button>
                    </div>
                </div>
            </header>

            <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[1fr_320px]">
                <section className="space-y-5">
                    {isAttemptMismatch ? (
                        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                            Attempt URL and stored attempt do not match. Please
                            restart from the mock test listing page if anything
                            looks incorrect.
                        </div>
                    ) : null}

                    {interfaceMessage ? (
                        <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
                            {interfaceMessage}
                        </div>
                    ) : null}

                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
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
                        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
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

                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
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

                        <h2 className="text-lg font-semibold leading-8 text-slate-950">
                            {getBestText(
                                currentQuestion?.questionTextEn,
                                currentQuestion?.questionTextHi
                            ) || "Question text not available."}
                        </h2>

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
                                        className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left text-sm transition ${
                                            isSelected
                                                ? "border-blue-600 bg-blue-50 ring-2 ring-blue-100"
                                                : "border-slate-200 bg-white hover:border-blue-300"
                                        }`}
                                    >
                                        <span
                                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
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
                                className="rounded-2xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white"
                            >
                                Save & Next
                            </button>

                            <button
                                type="button"
                                onClick={handleClearResponse}
                                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
                            >
                                Clear Response
                            </button>

                            <button
                                type="button"
                                onClick={handleMarkForReview}
                                className="rounded-2xl border border-purple-200 bg-purple-50 px-5 py-3 text-sm font-semibold text-purple-700"
                            >
                                Mark for Review
                            </button>
                        </div>
                    </div>
                </section>

                <aside className="lg:sticky lg:top-24 lg:self-start">
                    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                        <h2 className="text-base font-bold">
                            Question Palette
                        </h2>

                        <p className="mt-1 text-xs text-slate-500">
                            Section: {section?.name || "Not available"}
                        </p>

                        <div className="mt-4 grid grid-cols-5 gap-2">
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
                                        onClick={() =>
                                            setCurrentQuestionIndex(index)
                                        }
                                        className={`h-10 rounded-xl text-sm font-bold ${getPaletteClassName(
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

                        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                            <div className="rounded-2xl bg-emerald-50 p-3">
                                <p className="text-xs font-semibold text-emerald-700">
                                    Answered
                                </p>
                                <p className="mt-1 text-lg font-bold">
                                    {answeredCount}
                                </p>
                            </div>

                            <div className="rounded-2xl bg-purple-50 p-3">
                                <p className="text-xs font-semibold text-purple-700">
                                    Marked
                                </p>
                                <p className="mt-1 text-lg font-bold">
                                    {markedCount}
                                </p>
                            </div>
                        </div>

                        <div className="mt-5 space-y-2 text-xs text-slate-600">
                            <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full bg-blue-700" />
                                Current question
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full bg-emerald-600" />
                                Answered
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full bg-purple-600" />
                                Marked for review
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full bg-white ring-1 ring-slate-300" />
                                Not answered
                            </div>
                        </div>

                        <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm">
                            <p className="font-semibold">
                                Attempt Status
                            </p>

                            <p className="mt-1 text-slate-600">
                                {payload.attempt.status}
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
