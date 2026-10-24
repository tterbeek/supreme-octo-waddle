import { activitySources } from "../config/activitySources";

export default function ActivitySourceMark({ source }: { source: string }) {
  const config = activitySources[source.toLowerCase()] ?? {
    label: source.replace(/[_-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
  };
  const SourceIcon = config.icon;

  return (
    <span className="inline-flex items-center gap-1 opacity-60" aria-label={`Imported from ${config.label}`}>
      {SourceIcon && <SourceIcon size={16} strokeWidth={1.4} aria-hidden="true" />}
      <span>{config.label}</span>
    </span>
  );
}
