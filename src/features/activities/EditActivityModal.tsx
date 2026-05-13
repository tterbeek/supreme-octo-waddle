import { useState } from "react";
import { Trash2, Camera, ChevronDown, CalendarDays } from "lucide-react";
import { useUnitSystem } from "../../contexts/UnitContext";
import { useActivityEditForm } from "../../hooks/useActivityEditForm";
import { MAX_ACTIVITY_PHOTOS } from "../../lib/photos";
import { supportsEffort } from "../../config/activityTypes";
import EquipmentDialog from "../../components/EquipmentDialog";
import DistanceDurationFields from "../../components/quick-log/DistanceDurationFields";
import FeelingPhasesSelector from "../../components/quick-log/FeelingPhasesSelector";
import EffortSelector from "../../components/quick-log/EffortSelector";

type EditActivityModalProps = {
  activity: any; // existing activity record
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
  zIndexClass?: string;
  reflectionOnly?: boolean;
};

export default function EditActivityModal({
  activity,
  onClose,
  onUpdated,
  onDeleted,
  zIndexClass = "z-50",
  reflectionOnly = false,
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
    feelingDuring,
    setFeelingDuring,
    feelingAfter,
    setFeelingAfter,
    effort,
    setEffort,
    equipment,
    selectedEquipmentIds,
    setSelectedEquipmentIds,
    note,
    setNote,
    selectedFiles,
    setSelectedFiles,
    removeExistingPhotos,
    setRemoveExistingPhotos,
    existingPhotoTotal,
    pickImage,
    uploading,
    uploadError,
    uploadProgress,
    saving,
    deleting,
    animateIn,
    dragY,
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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const supportsDistanceField =
    defaultFields.includes("distance_km") || optionalFields.includes("distance_km");
  const supportsDurationField =
    defaultFields.includes("duration_min") || optionalFields.includes("duration_min");
  const detailsSummary = [
    supportsDistanceField ? "Distance" : null,
    supportsDurationField ? "time" : null,
    "equipment",
  ]
    .filter(Boolean)
    .join(", ");
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
        className={`fixed inset-0 bg-black/40 flex items-end justify-center overscroll-none ${zIndexClass}`}
        onClick={handleOverlayClick}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            transform: `translateY(${dragY}px)`,
            touchAction: "auto",
          }}
          className={`w-full max-w-md sm:max-w-2xl max-h-[100dvh] overflow-hidden bg-warm-100 rounded-t-2xl p-6 transition-transform duration-300 flex flex-col
      ${animateIn ? "translate-y-0" : "translate-y-full"} animate-fadeIn 
      shadow-lg will-change-transform sm:rounded-2xl`}
        >
        <div
          className="w-10 h-1.5 bg-warm-200 rounded-full mx-auto mb-4 touch-none"
          onTouchStart={handleTouchStart}
        />

        <h2 className="text-lg font-semibold text-center mb-4">
          {reflectionOnly ? "Add reflection" : "Edit Activity"}
        </h2>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-5 pb-4">
          {!reflectionOnly && (
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <label className="sr-only">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Title"
                  className="w-full rounded-lg border border-warm-200/70 bg-white/70 px-3 py-2.5 text-base text-gray-800 placeholder:text-gray-400 focus:border-movenotes-primary/30 focus:ring-2 focus:ring-movenotes-primary/20"
                />
              </div>

              <div className="shrink-0 rounded-full border border-warm-200/70 bg-white/70 px-2 py-2">
                <label className="sr-only">Date</label>
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <CalendarDays className="h-4 w-4 text-gray-400" />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="compact-date-input w-[5.25rem] bg-transparent text-right text-sm text-gray-500 outline-none [color-scheme:light]"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <FeelingPhasesSelector
              during={feelingDuring}
              after={feelingAfter}
              onDuringChange={setFeelingDuring}
              onAfterChange={setFeelingAfter}
            />
            {supportsEffort(activityType) && (
              <EffortSelector value={effort} onChange={setEffort} />
            )}
          </div>

          {!reflectionOnly && (
            <div className="pb-2">
              <button
                type="button"
                className="w-full flex items-center justify-between text-gray-800"
                onClick={() => {
                  const next = !detailsOpen;
                  setDetailsOpen(next);
                  if (next) {
                    if (optionalFields.includes("distance_km")) {
                      setShowOptionalDistance(true);
                    }
                    if (optionalFields.includes("duration_min")) {
                      setShowOptionalDuration(true);
                    }
                  }
                }}
              >
                <div className="text-left">
                  <div className="text-sm font-medium">Details</div>
                  <div className="text-xs text-gray-400">
                    {detailsSummary}
                  </div>
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
                    detailsOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ${
                  detailsOpen ? "max-h-[900px] opacity-100 pt-3" : "max-h-0 opacity-0"
                }`}
              >
                <div className="space-y-3">
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
                    onShowDistance={() => {}}
                    onShowDuration={() => {}}
                    suppressAddButtons
                    dense
                  />

                  <div>
                    <div className="text-sm text-gray-600 mb-1">Equipment</div>
                    <button
                      type="button"
                      onClick={() => setShowEquipmentDialog(true)}
                      className="w-full border border-warm-200 rounded-lg p-3 text-left text-gray-800"
                    >
                      {equipmentSummary || <span className="text-gray-400">None selected</span>}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm text-gray-700">Note</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={5}
              placeholder="How did it feel?"
              className="w-full rounded-xl bg-white/70 border border-warm-200/70 p-4 text-base text-gray-800 placeholder:text-gray-400 resize-none focus:ring-2 focus:ring-movenotes-primary/30 focus:border-movenotes-primary/30 transition"
            />
          </div>

          {/* Photo attach / clear */}
          <div className="flex items-center gap-3 flex-wrap mb-6">
            <button
              type="button"
              onClick={() => void pickImage("library")}
              className="hidden md:inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium text-gray-800 bg-gradient-to-r from-amber-200 to-amber-100 border border-amber-300 shadow-sm hover:shadow-md active:scale-95 transition"
            >
              <Camera className="w-4 h-4 text-amber-700" />
              <span>Choose photos</span>
            </button>
            <button
              type="button"
              onClick={() => void pickImage("camera")}
              className="inline-flex md:hidden items-center gap-2 px-3 py-2 rounded-full text-sm font-medium text-gray-800 bg-gradient-to-r from-amber-200 to-amber-100 border border-amber-300 shadow-sm hover:shadow-md active:scale-95 transition"
            >
              <Camera className="w-4 h-4 text-amber-700" />
              <span>Open camera</span>
            </button>
            <button
              type="button"
              onClick={() => void pickImage("library")}
              className="inline-flex md:hidden items-center gap-2 px-3 py-2 rounded-full text-sm font-medium text-gray-800 bg-gradient-to-r from-amber-200 to-amber-100 border border-amber-300 shadow-sm hover:shadow-md active:scale-95 transition"
            >
              <Camera className="w-4 h-4 text-amber-700" />
              <span>Choose photos</span>
            </button>
            {existingPhotoTotal > 0 && !removeExistingPhotos && (
              <button
                type="button"
                className="text-xs text-red-600 underline"
                onClick={() => {
                  setRemoveExistingPhotos(true);
                }}
              >
                Remove existing photos
              </button>
            )}
            {removeExistingPhotos && existingPhotoTotal > 0 && (
              <button
                type="button"
                className="text-xs text-gray-600 underline"
                onClick={() => setRemoveExistingPhotos(false)}
              >
                Undo remove ({existingPhotoTotal})
              </button>
            )}
            {selectedFiles.length > 0 && (
              <button
                type="button"
                className="text-xs text-red-600 underline"
                onClick={() => setSelectedFiles([])}
              >
                Clear selected
              </button>
            )}
          </div>
          {(existingPhotoTotal > 0 || selectedFiles.length > 0) && (
            <div className="text-xs text-gray-600">
              {removeExistingPhotos ? 0 : existingPhotoTotal}/{MAX_ACTIVITY_PHOTOS} existing · {selectedFiles.length}/{MAX_ACTIVITY_PHOTOS} selected
            </div>
          )}
          {selectedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs text-gray-600">
              {selectedFiles.map((file, index) => (
                <button
                  key={`${file.name}-${index}`}
                  type="button"
                  onClick={() =>
                    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
                  }
                  className="px-2 py-1 rounded-full border border-warm-200 bg-white/70 hover:bg-white"
                >
                  {file.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-warm-200/70 bg-warm-100 pt-4 pb-[env(safe-area-inset-bottom)]">
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
            disabled={saving || deleting}
            className="bg-movenotes-primary text-primary-text w-full py-3 rounded-full text-lg font-medium transition transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            {saving ? "Saving..." : reflectionOnly ? "Save reflection" : "Save Changes"}
          </button>

          {!reflectionOnly && (
            <>
              {confirmDelete && !deleting && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  Delete this activity permanently?
                </div>
              )}
              <button
                onClick={() => {
                  if (deleting) return;
                  if (!confirmDelete) {
                    setConfirmDelete(true);
                    return;
                  }
                  void handleDelete();
                }}
                disabled={saving || deleting}
                className="w-full mt-3 py-3 border border-movenotes-accent text-movenotes-accent rounded-full text-sm font-medium hover:bg-movenotes-accent/10 transition disabled:opacity-50"
              >
                {deleting ? (
                  "Deleting..."
                ) : confirmDelete ? (
                  "Confirm Delete"
                ) : (
                  <>
                    <Trash2 className="inline w-4 h-4 mr-1 -mt-0.5" />
                    Delete Activity
                  </>
                )}
              </button>
              {confirmDelete && !deleting && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="w-full mt-2 py-3 border border-warm-200 text-gray-700 rounded-full text-sm font-medium hover:bg-white/60 transition"
                >
                  Cancel
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>

    {showEquipmentDialog && !reflectionOnly && (
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
