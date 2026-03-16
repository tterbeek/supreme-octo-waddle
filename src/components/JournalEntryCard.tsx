type JournalEntryCardProps = {
  entry: any;
  onClick?: () => void;
};

export default function JournalEntryCard({ entry, onClick }: JournalEntryCardProps) {
  const isTinyTweakReflection = entry.entry_type === "tiny_tweak_reflection";
  const isJournalNote = entry.entry_type === "journal_note";
  const label = isTinyTweakReflection ? "Tiny tweak" : "Journal entry";
  const metadata = (() => {
    if (!entry.metadata) return null;
    if (typeof entry.metadata === "object") return entry.metadata;
    if (typeof entry.metadata === "string") {
      try {
        const parsed = JSON.parse(entry.metadata);
        return parsed && typeof parsed === "object" ? parsed : null;
      } catch {
        return null;
      }
    }
    return null;
  })();
  const tweakText =
    metadata?.tiny_tweak_text || metadata?.tweak_text || metadata?.tweakText || null;
  const bodyText = entry.entry_text ?? entry.text ?? "";
  const cardClassName =
    "relative rounded-xl p-5 bg-warm-100 border border-warm-200 text-left w-full mx-auto max-w-md sm:max-w-lg md:max-w-2xl lg:max-w-3xl sm:p-6 md:p-7";
  const reflectionClassName =
    "text-[15px] md:text-[17px] text-movenotes-text/80 font-[DMSerifDisplay] italic leading-snug whitespace-pre-line";
  const noteClassName =
    "text-[15px] md:text-[17px] text-movenotes-text/80 font-[DMSerifDisplay] italic leading-snug whitespace-pre-line max-w-xs sm:max-w-sm md:max-w-md";
  const tweakContextClassName =
    "text-[14px] md:text-[16px] text-movenotes-text/70 leading-snug";

  const content = (
    <>
      <div className="text-[12px] md:text-[13px] uppercase tracking-[0.16em] text-movenotes-text/90 mb-1">
        <span>{label}</span>
        {isTinyTweakReflection && (
          <span className="text-movenotes-text/60"> · Reflection</span>
        )}
      </div>
      {isTinyTweakReflection && (
        <p className={`${tweakContextClassName} mb-3`}>
          {tweakText || "(Tweak not available)"}
        </p>
      )}
      {bodyText && (
        <p
          className={`${isTinyTweakReflection ? "mt-0" : "mt-2"} ${
            isTinyTweakReflection ? reflectionClassName : noteClassName
          }`}
        >
          {isTinyTweakReflection ? `"${bodyText}"` : bodyText}
        </p>
      )}
    </>
  );

  if (isJournalNote && onClick) {
    return (
      <button type="button" onClick={onClick} className={`${cardClassName} block text-left`}>
        {content}
      </button>
    );
  }

  return <div className={cardClassName}>{content}</div>;
}
