import { useState } from "react";
import { Trash2, Camera } from "lucide-react";
import { useUnitSystem } from "../../contexts/UnitContext";
import { useActivityEditForm } from "../../hooks/useActivityEditForm";
import EquipmentDialog from "../../components/EquipmentDialog";
import ActivityForm from "./ActivityForm";

type EditActivityModalProps = {
  activity: any; // existing activity record
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
};

export default function EditActivityModal({
  activity,
  onClose,
  onUpdated,
  onDeleted,
}: EditActivityModalProps) {
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
    equipment,
    selectedEquipmentIds,
    setSelectedEquipmentIds,
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
    addEquipment,
  } = useActivityEditForm({
    activity,
    unitSystem,
    onClose,
    onUpdated,
    onDeleted,
  });
  const [showEquipmentDialog, setShowEquipmentDialog] = useState(false);
  const equipmentSummary = (() => {
    if (selectedEquipmentIds.length === 0) return "";
    const first = equipment.find((item) => item.id === selectedEquipmentIds[0]);
    if (!first) return "";
    const maxLen = 26;
    let label = first.name;
    if (label.length > maxLen) {
      label = `${label.slice(0, maxLen - 3)}...`;
    }
    if (selectedEquipmentIds.length > 1) {
      label = `${label}...`;
    }
    return label;
  })();

  return (
    <>
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
            touchAction: "pan-y",
          }}
          className={`w-full max-w-md max-h-[90vh] overflow-y-auto bg-warm-100 rounded-t-2xl p-6 transition-transform duration-300 
      ${animateIn ? "translate-y-0" : "translate-y-full"} animate-fadeIn 
      shadow-lg will-change-transform sm:rounded-2xl sm:mt-20`}
        >
        <div className="w-10 h-1.5 bg-warm-200 rounded-full mx-auto mb-4" />

        <h2 className="text-lg font-semibold text-center mb-4">
          Edit Activity
        </h2>

        <ActivityForm
          values={{
            title,
            date,
            distanceDisplay,
            duration,
            feeling: rating,
            effort,
            activityType,
            defaultFields,
            optionalFields,
            showOptionalDistance,
            showOptionalDuration,
          }}
          unitSystem={unitSystem}
          onTitleChange={setTitle}
          onDateChange={setDate}
          onDistanceChange={handleDistanceChange}
          onDurationChange={setDuration}
          onShowDistance={() => setShowOptionalDistance(true)}
          onShowDuration={() => setShowOptionalDuration(true)}
          onFeelingChange={setRating}
          onEffortChange={setEffort}
          equipmentSummary={equipmentSummary}
          onEquipmentClick={() => setShowEquipmentDialog(true)}
        />

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

    {showEquipmentDialog && (
      <EquipmentDialog
        equipment={equipment}
        selectedEquipmentIds={selectedEquipmentIds}
        onChange={(ids) => setSelectedEquipmentIds(ids)}
        onAddEquipment={addEquipment}
        onClose={() => setShowEquipmentDialog(false)}
      />
    )}
    </>
  );
}
