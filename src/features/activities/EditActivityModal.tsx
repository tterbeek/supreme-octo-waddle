import { useState } from "react";
import { Trash2, Camera, ChevronDown } from "lucide-react";
import { useUnitSystem } from "../../contexts/UnitContext";
import { useActivityEditForm } from "../../hooks/useActivityEditForm";
import EquipmentDialog from "../../components/EquipmentDialog";
import DistanceDurationFields from "../../components/quick-log/DistanceDurationFields";
import FeelingSelector from "../../components/quick-log/FeelingSelector";
import EffortSelector from "../../components/quick-log/EffortSelector";

type EditActivityModalProps = {
  activity: any; // existing activity record
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
  zIndexClass?: string;
};

export default function EditActivityModal({
  activity,
  onClose,
  onUpdated,
  onDeleted,
  zIndexClass = "z-50",
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
    cameraInputRef,
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
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            transform: `translateY(${dragY}px)`,
            touchAction: "pan-y",
          }}
          className={`w-full max-w-md sm:max-w-2xl max-h-[96vh] overflow-y-auto bg-warm-100 rounded-t-2xl p-6 transition-transform duration-300 
      ${animateIn ? "translate-y-0" : "translate-y-full"} animate-fadeIn 
      shadow-lg will-change-transform sm:rounded-2xl sm:mt-20`}
        >
        <div className="w-10 h-1.5 bg-warm-200 rounded-full mx-auto mb-4" />

        <h2 className="text-lg font-semibold text-center mb-4">
          Edit Activity
        </h2>

        <div className="space-y-5">
          <div>
            <label className="text-sm text-gray-700">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-warm-200 rounded-lg p-3 mt-1"
            />
          </div>

          <div className="space-y-4">
            <FeelingSelector value={rating} onChange={setRating} />
            {["run", "ride", "swim", "hike"].includes(activityType) && (
              <EffortSelector value={effort} onChange={setEffort} />
            )}
          </div>

          <div className="pb-2">
            <button
              type="button"
              className="w-full flex items-center justify-between text-gray-800"
              onClick={() => {
                const next = !detailsOpen;
                setDetailsOpen(next);
                if (next) {
                  setShowOptionalDistance(true);
                  setShowOptionalDuration(true);
                }
              }}
            >
              <div className="text-left">
                <div className="text-sm font-medium">Details</div>
                <div className="text-xs text-gray-400">
                  Distance, time, equipment
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
                <div>
                  <label className="text-sm text-gray-600">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full border border-warm-200 rounded-lg p-2.5"
                  />
                </div>

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
                  forceShowOptional
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
              onClick={() => fileInputRef.current?.click()}
              className="hidden md:inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium text-gray-800 bg-gradient-to-r from-amber-200 to-amber-100 border border-amber-300 shadow-sm hover:shadow-md active:scale-95 transition"
            >
              <Camera className="w-4 h-4 text-amber-700" />
              <span>Snap or attach</span>
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="inline-flex md:hidden items-center gap-2 px-3 py-2 rounded-full text-sm font-medium text-gray-800 bg-gradient-to-r from-amber-200 to-amber-100 border border-amber-300 shadow-sm hover:shadow-md active:scale-95 transition"
            >
              <Camera className="w-4 h-4 text-amber-700" />
              <span>Open camera</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex md:hidden items-center gap-2 px-3 py-2 rounded-full text-sm font-medium text-gray-800 bg-gradient-to-r from-amber-200 to-amber-100 border border-amber-300 shadow-sm hover:shadow-md active:scale-95 transition"
            >
              <Camera className="w-4 h-4 text-amber-700" />
              <span>Choose photo</span>
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
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
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
          className="bg-movenotes-primary text-primary-text w-full py-3 rounded-full text-lg font-medium transition transform hover:-translate-y-0.5 disabled:opacity-50 mt-4"
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
