type LogCTAProps = {
  showFirstLogPrompt: boolean;
  setShowTypeSelector: (open: boolean) => void;
};

export default function LogCTA({ showFirstLogPrompt, setShowTypeSelector }: LogCTAProps) {
  return (
    <>
      {showFirstLogPrompt && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl mb-4">
          <p className="font-medium mb-2">Welcome to MoveNotes ✨</p>
          <p className="text-sm mb-3">
            Start your movement story by logging your first activity.
          </p>
          <button
            onClick={() => setShowTypeSelector(true)}
            className="bg-movenotes-primary text-primary-text px-4 py-2 rounded-full text-sm font-medium"
          >
            Log my first activity
          </button>
        </div>
      )}

      <h2 className="text-sm font-medium text-gray-500 mb-2">
        Log Activity
      </h2>

      <div className="relative inline-block w-full">
        <button
          onClick={() => setShowTypeSelector(true)}
          className="w-full flex items-center justify-center gap-2 bg-amber-300 border border-amber-400 text-primary-text py-3 rounded-full text-lg font-medium my-2 transition transform hover:-translate-y-0.5 active:scale-95"
        >
          <span className="text-xl">+</span>
          <span>Activity</span>
        </button>
      </div>
    </>
  );
}
