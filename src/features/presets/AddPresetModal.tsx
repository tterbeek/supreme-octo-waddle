import { useEffect, useState } from "react";
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
import { createPreset, updatePresetEquipment } from "../../services/preset.service";

type AddPresetModalProps = {
  initialType: keyof typeof ACTIVITY_TYPES;
  onClose: () => void;
  onSaved: (preset?: Preset) => void;
};

export default function AddPresetModal({
  initialType,
  onClose,
  onSaved,
}: AddPresetModalProps) {
  const activityType = initialType;
  const typeConfig = ACTIVITY_TYPES[activityType] ?? ACTIVITY_TYPES["other"];
  const { unitSystem } = useUnitSystem();

  const [name, setName] = useState("");
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [duration, setDuration] = useState("");
  const [effort, setEffort] = useState(typeConfig.defaultFields.includes("duration_min") ? 3 : 3);
  const [showOptionalDistance, setShowOptionalDistance] = useState(
    typeConfig.defaultFields.includes("distance_km")
  );
  const [showOptionalDuration, setShowOptionalDuration] = useState(
    typeConfig.defaultFields.includes("duration_min")
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([]);
  const [showEquipmentDialog, setShowEquipmentDialog] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

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

  const save = async () => {
    setSaving(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      setError("Not signed in");
      return;
    }
    setUserId(user.id);

    const distanceValue =
      (typeConfig.defaultFields.includes("distance_km") || showOptionalDistance) &&
      distanceKm != null
        ? distanceKm
        : null;

    const durationValue =
      (typeConfig.defaultFields.includes("duration_min") || showOptionalDuration) &&
      duration
        ? roundDurationMinutes(Number(duration))
        : null;

    const effortValue = ["run", "ride", "swim", "hike"].includes(activityType)
      ? effort
      : null;

    const payload = {
      user_id: user.id,
      type: activityType,
      name,
      distance_km: distanceValue,
      duration_min: durationValue,
      effort: effortValue,
    };

    const { preset, error: insertErr } = await createPreset(payload);

    if (insertErr || !preset) {
      setError(insertErr?.message || "Could not save preset");
      setSaving(false);
      return;
    }

    const presetId = preset.id;

    if (presetId && selectedEquipmentIds.length > 0) {
      const { error: equipmentErr } = await updatePresetEquipment(
        presetId,
        selectedEquipmentIds
      );
      if (equipmentErr) {
        setError(equipmentErr.message || "Could not link equipment");
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    onSaved(preset as Preset);
  };

  const ensureUser = async () => {
    if (userId) return userId;
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    setUserId(data.user.id);
    return data.user.id;
  };

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

  useEffect(() => {
    const loadEquipment = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setUserId(data.user.id);
      const list = await fetchActiveEquipment(data.user.id);
      setEquipment(list);
    };
    loadEquipment();
  }, []);

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
    <ModalSheet onClose={onClose} enableDragToClose>
      <h2 className="text-lg font-semibold text-gray-800 mb-4 capitalize text-center">
        Add {typeConfig.label} preset
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
        disabled={saving}
        className="bg-amber-300 border border-amber-400 text-primary-text w-full py-3 rounded-full text-lg font-medium transition transform hover:-translate-y-0.5"
      >
        {saving ? "Saving..." : "Save preset"}
      </button>

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
