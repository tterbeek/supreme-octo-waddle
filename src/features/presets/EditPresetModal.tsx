import { useState, useEffect } from "react";
import ModalSheet from "../../components/ModalSheet";
import { ACTIVITY_TYPES } from "../../config/activityTypes";
import { useUnitSystem } from "../../contexts/UnitContext";
import { kmToMiles, milesToKm, roundDurationMinutes } from "../../lib/units";
import PresetForm from "./PresetFormContent";
import type { Preset } from "../../types";
import { supabase } from "../../supabaseClient";
import { fetchActiveEquipment, createEquipment } from "../../services/equipment.service";
import EquipmentDialog from "../../components/EquipmentDialog";
import type { Equipment } from "../../types";
import { replacePresetEquipment } from "../../services/equipment.service";
import { updatePreset } from "../../services/preset.service";

type EditPresetModalProps = {
  preset: Preset;
  onClose: () => void;
  onSaved: (preset?: Preset) => void;
  onDeleted: (id: string) => void;
};

export default function EditPresetModal({
  preset,
  onClose,
  onSaved,
  onDeleted,
}: EditPresetModalProps) {
  const activityType = (preset.type as keyof typeof ACTIVITY_TYPES) || "run";
  const typeConfig = ACTIVITY_TYPES[activityType] ?? ACTIVITY_TYPES["other"];
  const { unitSystem } = useUnitSystem();

  const [name, setName] = useState(preset.name ?? "");
  const [distanceKm, setDistanceKm] = useState<number | null>(preset.distance_km ?? null);
  const [duration, setDuration] = useState(
    preset.duration_min != null
      ? String(roundDurationMinutes(Number(preset.duration_min)))
      : ""
  );
  const [effort, setEffort] = useState(preset.effort ?? 3);
  const [showOptionalDistance, setShowOptionalDistance] = useState(
    typeConfig.defaultFields.includes("distance_km") ||
      (typeConfig.optionalFields.includes("distance_km") && distanceKm != null)
  );
  const [showOptionalDuration, setShowOptionalDuration] = useState(
    typeConfig.defaultFields.includes("duration_min") ||
      (typeConfig.optionalFields.includes("duration_min") && duration !== "")
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([]);
  const [showEquipmentDialog, setShowEquipmentDialog] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    setName(preset.name ?? "");
    setDistanceKm(preset.distance_km ?? null);
    setDuration(
      preset.duration_min != null
        ? String(roundDurationMinutes(Number(preset.duration_min)))
        : ""
    );
    setEffort(preset.effort ?? 3);
  }, [preset]);

  const distanceDisplay =
    distanceKm == null
      ? ""
      : unitSystem === "imperial"
      ? String(Math.round(kmToMiles(distanceKm) * 100) / 100)
      : String(distanceKm);

  const handleDistanceChange = (value: string) => {
    if (value === "") {
      setDistanceKm(null);
      return;
    }
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return;
    const kmValue = unitSystem === "imperial" ? milesToKm(numeric) : numeric;
    setDistanceKm(kmValue);
  };

  const ensureUser = async () => {
    if (userId) return userId;
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    setUserId(data.user.id);
    return data.user.id;
  };

  useEffect(() => {
    const loadEquipment = async () => {
      const currentUserId = await ensureUser();
      if (!currentUserId) return;
      const list = await fetchActiveEquipment(currentUserId);
      setEquipment(list);
      if (preset.preset_equipment && preset.preset_equipment.length > 0) {
        const ids = preset.preset_equipment
          .map((item: any) => item?.equipment?.id)
          .filter(Boolean);
        setSelectedEquipmentIds(ids);
      }
    };
    loadEquipment();
  }, [preset]);

  const addEquipment = async (eqName: string, notes: string) => {
    const currentUserId = await ensureUser();
    if (!currentUserId) return null;
    const { equipment: created } = await createEquipment({
      userId: currentUserId,
      name: eqName,
      notes,
    });
    if (!created) return null;
    setEquipment((prev) => [created, ...prev]);
    setSelectedEquipmentIds((prev) =>
      prev.includes(created.id) ? prev : [...prev, created.id]
    );
    return created;
  };

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

  const save = async () => {
    setSaving(true);
    setError(null);
    const payload = {
      name,
      distance_km:
        (typeConfig.defaultFields.includes("distance_km") || showOptionalDistance) &&
        distanceKm != null
          ? distanceKm
          : null,
      duration_min:
        (typeConfig.defaultFields.includes("duration_min") || showOptionalDuration) && duration
          ? roundDurationMinutes(Number(duration))
          : null,
      effort: ["run", "ride", "swim", "hike"].includes(activityType) ? effort : null,
    };

    const { preset: updated, error: updateErr } = await updatePreset(preset.id, {
      ...payload,
      type: activityType,
    });

    if (updateErr || !updated) {
      setError(updateErr?.message || "Could not save preset");
      setSaving(false);
      return;
    }

    const { error: equipmentErr } = await replacePresetEquipment(
      preset.id,
      selectedEquipmentIds
    );
    if (equipmentErr) {
      setError(equipmentErr.message || "Could not link equipment");
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved(updated as Preset);
  };

  const remove = async () => {
    if (deleting) return;
    setDeleting(true);
    setError(null);
    const { error: delErr } = await supabase.from("presets").delete().eq("id", preset.id);
    setDeleting(false);
    if (delErr) {
      setError(delErr.message || "Could not delete preset");
      return;
    }
    onDeleted(preset.id);
    onClose();
  };

  return (
    <ModalSheet onClose={onClose} enableDragToClose>
      <h2 className="text-lg font-semibold text-gray-800 mb-4 capitalize text-center">
        Edit preset
      </h2>

      <PresetForm
        values={{
          name,
          title: "",
          distanceDisplay,
          duration,
          feeling: 3,
          effort,
          activityType,
          defaultFields: typeConfig.defaultFields,
          optionalFields: typeConfig.optionalFields,
          showOptionalDistance,
          showOptionalDuration,
        }}
        unitSystem={unitSystem}
        onNameChange={setName}
        onDistanceChange={handleDistanceChange}
        onDurationChange={setDuration}
        onShowDistance={() => setShowOptionalDistance(true)}
        onShowDuration={() => setShowOptionalDuration(true)}
        onEffortChange={setEffort}
        equipmentSummary={equipmentSummary}
        onEquipmentClick={() => setShowEquipmentDialog(true)}
      />

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <button
        onClick={save}
        disabled={saving || deleting}
        className="bg-amber-300 border border-amber-400 text-primary-text w-full py-3 rounded-full text-lg font-medium transition transform hover:-translate-y-0.5"
      >
        {saving ? "Saving..." : "Save changes"}
      </button>

      {confirmDelete && !deleting && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Delete this preset permanently?
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          if (deleting) return;
          if (!confirmDelete) {
            setConfirmDelete(true);
            return;
          }
          void remove();
        }}
        disabled={saving || deleting}
        className="w-full mt-3 py-3 border border-movenotes-accent text-movenotes-accent rounded-full text-sm font-medium hover:bg-movenotes-accent/10 transition disabled:opacity-50"
      >
        {deleting ? "Deleting..." : confirmDelete ? "Confirm Delete" : "Delete preset"}
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

      {showEquipmentDialog && (
        <EquipmentDialog
          equipment={equipment}
          selectedEquipmentIds={selectedEquipmentIds}
          onChange={setSelectedEquipmentIds}
          onAddEquipment={addEquipment}
          onClose={() => setShowEquipmentDialog(false)}
        />
      )}
    </ModalSheet>
  );
}
