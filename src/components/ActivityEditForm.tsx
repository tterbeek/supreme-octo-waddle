import { Trash2, Camera } from "lucide-react";
import DistanceDurationFields from "./quick-log/DistanceDurationFields";
import FeelingSelector from "./quick-log/FeelingSelector";
import EffortSelector from "./quick-log/EffortSelector";
import { useUnitSystem } from "../contexts/UnitContext";
import { useActivityEditForm } from "../hooks/useActivityEditForm";

type ActivityEditFormProps = {
  activity: any; // existing activity record
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
};

export default function ActivityEditForm({
  activity,
  onClose,
  onUpdated,
  onDeleted,
}: ActivityEditFormProps) {
  const { unitSystem } = useUnitSystem();
  const {
    title,
    setTitle,
    defaultFields,
    optionalFields,
    showOptionalDistance,
    setShowOptionalDistance,
    showOptionalDuration,
    setShowOptionalDuration,
    duration,
    setDuration,
    date,
    setDate,
    rating,
    setRating,
    effort,
    setEffort,
    note,
    setNote,
    noteImageUrl,
    setNoteImageUrl,
    selectedFile,
    setSelectedFile,
    uploading,
    uploadError,
    uploadProgress,
    setUploadError,
    setUploadProgress,
    saving,
    animateIn,
    dragY,
    fileInputRef,
    distanceDisplay,
    handleDistanceChange,
    activityType,
    handleSave,
    handleDelete,
    handleOverlayClick,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = useActivityEditForm({
    activity,
    unitSystem,
    onClose,
    onUpdated,
    onDeleted,
  });

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 overscroll-none"
      onClick={handleOverlayClick}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateY(${dragY}px)`,
          touchAction: "none",
        }}
        className={`w-full max-w-md bg-warm-100 rounded-t-2xl p-6 transition-transform duration-300 
      ${animateIn ? "translate-y-0" : "translate-y-full"} animate-fadeIn 
      shadow-lg will-change-transform sm:rounded-2xl sm:mt-20`}
      >
        <div className="w-10 h-1.5 bg-warm-200 rounded-full mx-auto mb-4" />

        <h2 className="text-lg font-semibold text-center mb-4">
          Edit Activity
        </h2>

        {/* Title */}
        <label className="text-sm text-gray-600">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-warm-200 rounded-md p-2 mb-4"
        />

        {/* Date */}
        <label className="text-sm text-gray-600">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full border border-warm-200 rounded-md p-2 mb-4"
        />

        <DistanceDurationFields
          defaultFields={defaultFields}
          optionalFields={optionalFields}
          showOptionalDistance={showOptionalDistance}
          showOptionalDuration={showOptionalDuration}
          displayDistance={distanceDisplay}
          duration={duration}
          unitSystem={unitSystem}
          onDistanceChange={handleDistanceChange}
          onDurationChange={setDuration}
          onShowDistance={() => setShowOptionalDistance(true)}
          onShowDuration={() => setShowOptionalDuration(true)}
        />

        {/* Feeling & Effort */}
        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-1">
            Feeling & Effort
          </label>

          <div className="flex flex-col items-center gap-4">
            <div className="flex justify-between w-full max-w-sm">
              <FeelingSelector value={rating} onChange={setRating} />
            </div>

            {["run", "ride", "swim", "hike"].includes(activityType) && (
              <EffortSelector value={effort} onChange={setEffort} />
            )}
          </div>
        </div>

        {/* Notes */}
        <label className="text-sm text-gray-600">Notes</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Add a short note about your activity..."
          className="w-full border border-warm-200 rounded-md p-2 mb-4 resize-none focus:ring-1 focus:ring-movenotes-primary"
        />

        {/* Photo attach / clear */}
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <button
            type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium text-gray-800 bg-gradient-to-r from-amber-200 to-amber-100 border border-amber-300 shadow-sm hover:shadow-md active:scale-95 transition"
        >
          <Camera className="w-4 h-4 text-amber-700" />
          <span>Snap or attach</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setSelectedFile(file);
              setUploadError(null);
              setUploadProgress(0);
            }}
            className="hidden"
          />
          {noteImageUrl && (
            <button
              type="button"
              className="text-xs text-red-600 underline"
              onClick={() => {
                setNoteImageUrl(null);
                setSelectedFile(null);
              }}
            >
              Remove current image
            </button>
          )}
          {selectedFile && (
            <span className="text-xs text-gray-600">
              Selected: {selectedFile.name}
            </span>
          )}
        </div>

        {uploadError && (
          <p className="text-sm text-red-600 mb-2">{uploadError}</p>
        )}
        {(uploading || saving) && (
          <div className="mb-4">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-2 bg-movenotes-primary transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {uploading ? "Uploading image..." : "Saving..."}
            </p>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-movenotes-primary text-primary-text w-full py-3 rounded-full text-lg font-medium transition transform hover:-translate-y-0.5 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>

        <button
          onClick={handleDelete}
          className="w-full mt-3 py-3 border border-movenotes-accent text-movenotes-accent rounded-full text-sm font-medium hover:bg-movenotes-accent/10 transition"
        >
          <Trash2 className="inline w-4 h-4 mr-1 -mt-0.5" />
          Delete Activity
        </button>
      </div>
    </div>
  );
}
