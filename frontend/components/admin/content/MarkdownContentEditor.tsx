"use client";

import { useRef, useState } from "react";
import PublicContentBody from "@/components/public/PublicContentBody";

type MarkdownContentEditorProps = {
    id: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    rows?: number;
};

const toolbarButtonClass =
    "rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-100";

export default function MarkdownContentEditor({
    id,
    value,
    onChange,
    placeholder,
    rows = 16,
}: MarkdownContentEditorProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [showPreview, setShowPreview] = useState(false);

    const updateValueAndSelection = (
        nextValue: string,
        selectionStart: number,
        selectionEnd: number
    ) => {
        onChange(nextValue);

        window.requestAnimationFrame(() => {
            const textarea = textareaRef.current;

            if (!textarea) {
                return;
            }

            textarea.focus();
            textarea.setSelectionRange(selectionStart, selectionEnd);
        });
    };

    const getSelection = () => {
        const textarea = textareaRef.current;
        const start = textarea?.selectionStart ?? value.length;
        const end = textarea?.selectionEnd ?? value.length;

        return {
            start,
            end,
            selectedText: value.slice(start, end),
        };
    };

    const replaceSelection = (
        replacement: string,
        highlightStart = replacement.length,
        highlightEnd = highlightStart
    ) => {
        const { start, end } = getSelection();
        const nextValue =
            value.slice(0, start) +
            replacement +
            value.slice(end);

        updateValueAndSelection(
            nextValue,
            start + highlightStart,
            start + highlightEnd
        );
    };

    const insertBlock = (
        block: string,
        editableStart = block.length,
        editableEnd = editableStart
    ) => {
        const { start, end } = getSelection();
        const before = value.slice(0, start);
        const after = value.slice(end);

        const leadingSpacing =
            before.length === 0 || before.endsWith("\n\n")
                ? ""
                : before.endsWith("\n")
                    ? "\n"
                    : "\n\n";

        const trailingSpacing =
            after.length === 0 || after.startsWith("\n\n")
                ? ""
                : after.startsWith("\n")
                    ? "\n"
                    : "\n\n";

        const insertion = leadingSpacing + block + trailingSpacing;
        const blockStart = start + leadingSpacing.length;
        const nextValue = before + insertion + after;

        updateValueAndSelection(
            nextValue,
            blockStart + editableStart,
            blockStart + editableEnd
        );
    };

    const wrapSelection = (
        prefix: string,
        suffix: string,
        fallback: string
    ) => {
        const { start, end, selectedText } = getSelection();
        const text = selectedText || fallback;
        const replacement = prefix + text + suffix;
        const nextValue =
            value.slice(0, start) +
            replacement +
            value.slice(end);

        updateValueAndSelection(
            nextValue,
            start + prefix.length,
            start + prefix.length + text.length
        );
    };

    const addHeading = () => {
        const { selectedText } = getSelection();
        const selectedHeading = selectedText
            .replace(/\s+/g, " ")
            .trim();

        const requestedHeading =
            selectedHeading ||
            window.prompt(
                "Enter the section heading:",
                "Section Heading"
            );

        if (!requestedHeading) {
            return;
        }

        const heading = requestedHeading
            .replace(/\s+/g, " ")
            .trim();

        if (!heading) {
            return;
        }

        insertBlock("## " + heading);
    };

    const addBulletList = () => {
        const { selectedText } = getSelection();
        const listText = selectedText || "First item\nSecond item";

        const formattedList = listText
            .split("\n")
            .map((line) => {
                const cleanLine = line
                    .replace(/^\s*[-*+]\s+/, "")
                    .trim();

                return cleanLine ? "- " + cleanLine : "";
            })
            .join("\n");

        insertBlock(formattedList);
    };

    const addNumberedList = () => {
        const { selectedText } = getSelection();
        const listText = selectedText || "First item\nSecond item";

        const formattedList = listText
            .split("\n")
            .map((line, index) => {
                const cleanLine = line
                    .replace(/^\s*\d+[.)]\s+/, "")
                    .trim();

                return cleanLine
                    ? String(index + 1) + ". " + cleanLine
                    : "";
            })
            .join("\n");

        insertBlock(formattedList);
    };

    const addLink = () => {
        const { selectedText } = getSelection();
        const selectedLabel = selectedText
            .replace(/\s+/g, " ")
            .trim();

        const requestedLabel =
            selectedLabel ||
            window.prompt(
                "Enter the text displayed for this link:",
                "Official website"
            );

        if (!requestedLabel) {
            return;
        }

        const label = requestedLabel
            .replace(/\s+/g, " ")
            .trim();

        if (!label) {
            return;
        }

        const requestedUrl = window.prompt(
            "Enter the complete official URL:",
            "https://"
        );

        if (!requestedUrl) {
            return;
        }

        const url = requestedUrl.trim();

        try {
            const parsedUrl = new URL(url);

            if (
                parsedUrl.protocol !== "http:" &&
                parsedUrl.protocol !== "https:"
            ) {
                throw new Error("Unsupported URL protocol.");
            }
        } catch {
            window.alert(
                "Please enter a valid URL beginning with http:// or https://."
            );
            return;
        }

        replaceSelection(
            "[" + label + "](" + url + ")"
        );
    };

    const addTable = () => {
        const table = [
            "| Particular | Details |",
            "| --- | --- |",
            "| Item | Value |",
        ].join("\n");

        const itemStart = table.indexOf("Item");

        insertBlock(
            table,
            itemStart,
            itemStart + "Item".length
        );
    };

    const addImportantNote = () => {
        const { selectedText } = getSelection();
        const note =
            selectedText ||
            "Write the important information here.";

        const prefix = "> **Important:** ";

        insertBlock(
            prefix + note,
            prefix.length,
            prefix.length + note.length
        );
    };

    return (
        <div className="mt-2 overflow-hidden rounded-2xl border border-slate-300 bg-white focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 p-3">
                <button
                    type="button"
                    onClick={addHeading}
                    className={toolbarButtonClass}
                    title="Insert a section heading"
                >
                    Heading
                </button>

                <button
                    type="button"
                    onClick={() => wrapSelection("**", "**", "bold text")}
                    className={toolbarButtonClass}
                    title="Make selected text bold"
                >
                    Bold
                </button>

                <button
                    type="button"
                    onClick={() => wrapSelection("*", "*", "italic text")}
                    className={toolbarButtonClass}
                    title="Make selected text italic"
                >
                    Italic
                </button>

                <button
                    type="button"
                    onClick={addBulletList}
                    className={toolbarButtonClass}
                    title="Insert a bullet list"
                >
                    Bullets
                </button>

                <button
                    type="button"
                    onClick={addNumberedList}
                    className={toolbarButtonClass}
                    title="Insert a numbered list"
                >
                    Numbered
                </button>

                <button
                    type="button"
                    onClick={addLink}
                    className={toolbarButtonClass}
                    title="Insert a safe Markdown link"
                >
                    Link
                </button>

                <button
                    type="button"
                    onClick={addTable}
                    className={toolbarButtonClass}
                    title="Insert a two-column table"
                >
                    Table
                </button>

                <button
                    type="button"
                    onClick={addImportantNote}
                    className={toolbarButtonClass}
                    title="Insert an important-note box"
                >
                    Important Note
                </button>

                <button
                    type="button"
                    onClick={() => setShowPreview((current) => !current)}
                    aria-pressed={showPreview}
                    className={
                        showPreview
                            ? "ml-auto rounded-xl border border-blue-700 bg-blue-700 px-3 py-2 text-xs font-bold text-white focus:outline-none focus:ring-4 focus:ring-blue-100"
                            : toolbarButtonClass + " ml-auto"
                    }
                >
                    {showPreview ? "Edit Content" : "Preview"}
                </button>
            </div>

            {showPreview ? (
                <div className="min-h-80 bg-white p-5 sm:p-7">
                    {value.trim() ? (
                        <PublicContentBody content={value} />
                    ) : (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">
                            Write some content to see the preview.
                        </div>
                    )}
                </div>
            ) : (
                <textarea
                    ref={textareaRef}
                    id={id}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={placeholder}
                    rows={rows}
                    className="block w-full resize-y border-0 px-4 py-4 text-sm leading-7 text-slate-900 outline-none"
                />
            )}

            <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
                Select text before using Bold or Italic. Heading and Link will guide you.
                Use Preview to check headings, tables, lists and official links before saving.
            </div>
        </div>
    );
}
