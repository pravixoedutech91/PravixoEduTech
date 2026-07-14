type PublicSearchBarProps = {
  placeholder?: string;
  compact?: boolean;
  defaultValue?: string;
};

export default function PublicSearchBar({
  placeholder = "Search notes, current affairs, syllabus, jobs...",
  compact = false,
  defaultValue = "",
}: PublicSearchBarProps) {
  return (
    <form
      action="/search"
      className={
        compact
          ? "flex w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          : "flex w-full flex-col gap-3 rounded-3xl border border-white/20 bg-white/95 p-2 shadow-2xl shadow-blue-950/20 backdrop-blur sm:flex-row"
      }
    >
      <label htmlFor="public-search" className="sr-only">
        Search PravixoEduTech
      </label>

      <input
        id="public-search"
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={
          compact
            ? "min-h-12 flex-1 border-0 px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400"
            : "min-h-14 flex-1 rounded-2xl border border-slate-200 bg-white px-5 text-base text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        }
      />

      <button
        type="submit"
        className={
          compact
            ? "bg-blue-700 px-5 text-sm font-semibold text-white transition hover:bg-blue-800"
            : "rounded-2xl bg-blue-700 px-7 py-3 text-sm font-bold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-200"
        }
      >
        Search
      </button>
    </form>
  );
}
