type LogCTAProps = {
  showFirstLogPrompt: boolean;
};

export default function LogCTA({ showFirstLogPrompt }: LogCTAProps) {
  if (!showFirstLogPrompt) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl mb-4">
      <p className="font-medium mb-2">Welcome to MoveNotes ✨</p>
      <p className="text-sm">
        Start your movement story by using the + Add activity button in the corner to log your first entry.
      </p>
    </div>
  );
}
