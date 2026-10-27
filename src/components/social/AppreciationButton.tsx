import { IconHeart, IconHeartFilled } from '@tabler/icons-react';

export default function AppreciationButton({ appreciated, othersAppreciated, disabled, onToggle }: {
  appreciated: boolean;
  othersAppreciated: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return <div className="inline-flex items-center gap-1">
    <button type="button" aria-label="Appreciate" aria-pressed={appreciated} disabled={disabled} onClick={onToggle}
      title={appreciated ? 'Remove your appreciation' : 'Appreciate'}
      className={`flex min-h-11 min-w-11 items-center justify-center rounded-full disabled:opacity-50 ${appreciated ? 'text-movenotes-primary' : 'text-gray-500'}`}>
      {appreciated ? <IconHeartFilled size={23} aria-hidden="true" /> : <IconHeart size={23} aria-hidden="true" />}
    </button>
    {othersAppreciated && <span role="img" aria-label="Others have appreciated this activity" title="Others have appreciated this activity" className="inline-flex items-center text-movenotes-primary/65"><IconHeart size={19} aria-hidden="true" /></span>}
  </div>;
}
