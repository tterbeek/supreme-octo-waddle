import { useEffect, useState, type ReactNode } from "react";
import { ACTIVITY_TYPES } from "../config/activityTypes";
import {
  resolveActivityFields,
  type ActivityPreference,
} from "../lib/resolveActivityFields";
import { kmToMiles, milesToKm, roundDurationMinutes } from "../lib/units";
import type { TooltipKey } from "./useTooltipManager";
import { getCurrentUser } from "../services/auth.service";
import {
  createPresetFromActivity,
  fetchActivityPreference,
  fetchPresets,
  saveQuickLog,
  type SaveQuickLogInput,
  updatePresetLastUsed,
} from "../services/quickLog.service";
import { createEquipment, fetchActiveEquipment } from "../services/equipment.service";
import type { Preset, Equipment } from "../types";

type UseQuickLogFormArgs = {
  initialType: string;
  initialDate?: string;
  returnTo?: string;
  unitSystem: string;
  onClose: () => void;
  onLogged: (activityId: string) => void;
  onboardingDone: boolean;
  showTooltip: (key: TooltipKey) => void;
  navigate: (path: string) => void;
  ding: HTMLAudioElement;
};

export function useQuickLogForm({
  initialType,
  initialDate,
  returnTo,
  unitSystem,
  onClose,
  onLogged,
  onboardingDone,
  showTooltip,
  navigate,
  ding,
}: UseQuickLogFormArgs) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [activePreset, setActivePreset] = useState<Preset | null>(null);

  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [duration, setDuration] = useState("");
  const [feeling, setFeeling] = useState(3);
  const [date, setDate] = useState(
    initialDate || new Date().toISOString().slice(0, 10)
  );
  const [title, setTitle] = useState("");
  const [effort, setEffort] = useState<number>(3);
  const [saveAsPreset, setSaveAsPreset] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetNameTouched, setPresetNameTouched] = useState(false);
  const [showOptionalDistance, setShowOptionalDistance] = useState(false);
  const [showOptionalDuration, setShowOptionalDuration] = useState(false);
  const [showMetricTooltip, setShowMetricTooltip] = useState(false);
  const [metricTooltip, setMetricTooltip] = useState<ReactNode>("");
  const [metricTooltipAcknowledged, setMetricTooltipAcknowledged] = useState(false);
  const [tooltipAlreadySeen] = useState(() => {
    if (typeof window === "undefined") return false;
    const key = `metric_tooltip_seen_${initialType}`;
    return localStorage.getItem(key) === "true";
  });
  const tooltipSeenKey = `metric_tooltip_seen_${initialType}`;

  const [activityType] = useState(initialType);
  const typeConfig = ACTIVITY_TYPES[activityType];
  const [preference, setPreference] = useState<ActivityPreference | undefined>();
  const { defaultFields, optionalFields } = resolveActivityFields(
    activityType,
    preference
  );

  const filteredPresets = presets.filter((p) => p.type === activityType);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const displayDistance =
    distanceKm == null
      ? ""
      : unitSystem === "imperial"
      ? String(Math.round(kmToMiles(distanceKm) * 100) / 100)
      : String(distanceKm);

  const ensureUserId = async () => {
    if (userId) return userId;
    const user = await getCurrentUser();
    if (!user) return null;
    setUserId(user.id);
    return user.id;
  };

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

  useEffect(() => {
    setShowOptionalDistance(false);
    setShowOptionalDuration(false);
    setPreference(undefined);
    setSelectedEquipmentIds([]);
    const load = async () => {
      const user = await getCurrentUser();

      if (!user) return;

      setUserId(user.id);

      const presetData = await fetchPresets(user.id);
      setPresets(presetData);

      const initialPresets = (presetData || []).filter(
        (p) => p.type === activityType
      );

      if (initialPresets.length > 0) {
        const first = initialPresets[0];
        setActivePreset(first);
        setDistanceKm(first.distance_km ?? null);
        setDuration(
          first.duration_min != null
            ? String(roundDurationMinutes(Number(first.duration_min)))
            : ""
        );
        setShowOptionalDistance(!!first.distance_km);
        setShowOptionalDuration(!!first.duration_min);
        setTitle(first.name ?? "");
        setEffort(first.effort ?? 3);
        setSelectedEquipmentIds(first.equipment_ids ?? []);
      }

      const preferenceData = await fetchActivityPreference(user.id, activityType);
      setPreference(preferenceData);

      const equipmentList = await fetchActiveEquipment(user.id);
      setEquipment(equipmentList);
    };

    load();
  }, [activityType]);

  useEffect(() => {
    if (!presetNameTouched) {
      setPresetName(title);
    }
  }, [title, presetNameTouched]);

  const usePreset = (preset: Preset) => {
    setActivePreset(preset);
    setDistanceKm(preset.distance_km ?? null);
    setDuration(
      preset.duration_min != null
        ? String(roundDurationMinutes(Number(preset.duration_min)))
        : ""
    );
    setShowOptionalDistance(!!preset.distance_km);
    setShowOptionalDuration(!!preset.duration_min);
    setTitle(preset.name ?? "");
    setEffort(preset.effort ?? 3);
    setSelectedEquipmentIds(preset.equipment_ids ?? []);
  };

  const useCustom = () => {
    setActivePreset(null);
    setDistanceKm(null);
    setDuration("");
    setTitle("");
    setPresetName("");
    setPresetNameTouched(false);
    setShowOptionalDistance(false);
    setShowOptionalDuration(false);
    setSelectedEquipmentIds([]);
  };

  const addEquipment = async (name: string, notes: string) => {
    const currentUserId = await ensureUserId();
    if (!currentUserId) return null;

    const { equipment: created } = await createEquipment({
      userId: currentUserId,
      name,
      notes: notes || undefined,
    });

    if (!created) {
      return null;
    }

    setEquipment((prev) => [created, ...prev]);
    setSelectedEquipmentIds((prev) =>
      prev.includes(created.id) ? prev : [...prev, created.id]
    );

    return created;
  };

  const save = async () => {
    const needsDistance = defaultFields.includes("distance_km");
    const needsDuration = defaultFields.includes("duration_min");
    const defaultMetricLabel = needsDistance ? "distance" : "duration";
    const altMetricLabel = needsDistance ? "duration" : "distance";

    if (
      needsDistance &&
      distanceKm == null &&
      !metricTooltipAcknowledged &&
      !tooltipAlreadySeen
    ) {
      setMetricTooltip(
        <>
          <p className="text-sm text-gray-800">
            {typeConfig.label} tracks {defaultMetricLabel} by default. You’re logging only{" "}
            {altMetricLabel}. If you prefer using {altMetricLabel} for this activity,
            change the default metric in Settings → Activity Preferences.
          </p>
          <a
            href="/settings/activity-preferences"
            className="text-sm text-movenotes-primary underline block mt-2"
          >
            Go to Activity Preferences
          </a>
          <p className="text-xs text-gray-600 mt-2">
            Close to save anyway without {defaultMetricLabel}.
          </p>
        </>
      );
      setShowMetricTooltip(true);
      return;
    }

    if (needsDuration && !duration && !metricTooltipAcknowledged && !tooltipAlreadySeen) {
      setMetricTooltip(
        <>
          <p className="text-sm text-gray-800">
            {typeConfig.label} tracks {defaultMetricLabel} by default. You’re logging only{" "}
            {altMetricLabel}. If you prefer using {altMetricLabel} for this activity,
            change the default metric in Settings → Activity Preferences.
          </p>
          <a
            href="/settings/activity-preferences"
            className="text-sm text-movenotes-primary underline block mt-2"
          >
            Go to Activity Preferences
          </a>
          <p className="text-xs text-gray-600 mt-2">
            Close to save anyway without {defaultMetricLabel}.
          </p>
        </>
      );
      setShowMetricTooltip(true);
      return;
    }

    const currentUserId = await ensureUserId();
    if (!currentUserId) return;

    const distanceValue =
      (defaultFields.includes("distance_km") || showOptionalDistance) && distanceKm != null
        ? distanceKm
        : null;

    const durationValue =
      (defaultFields.includes("duration_min") || showOptionalDuration) && duration
        ? roundDurationMinutes(Number(duration))
        : null;

    const effortValue = ["run", "ride", "swim", "hike"].includes(activityType)
      ? Number(effort) || null
      : null;

    const feelingValue = Number(feeling) || null;

    const saveInput: SaveQuickLogInput = {
      userId: currentUserId,
      activityType,
      date,
      distanceValue,
      durationValue,
      effortValue,
      feelingValue,
      title,
      equipmentIds: selectedEquipmentIds,
    };

    const { id: newActivityId, error } = await saveQuickLog(saveInput);

    if (error || !newActivityId) {
      return;
    }

    if (saveAsPreset && presetName.trim()) {
      await createPresetFromActivity({
        userId: currentUserId,
        activityType,
        name: presetName.trim(),
        distanceValue,
        durationValue,
        effortValue,
      });
    }

    if (activePreset) {
      await updatePresetLastUsed(activePreset.id);
    }

    if (onboardingDone) {
      showTooltip("after_first_log");
    }
    ding.play();
    onLogged(newActivityId);

    const targetPath = returnTo || "/";
    setTimeout(() => {
      onClose();
      navigate(targetPath);
    }, 400);
  };

  return {
    presets,
    setPresets,
    activePreset,
    setActivePreset,
    distanceKm,
    setDistanceKm,
    duration,
    setDuration,
    feeling,
    setFeeling,
    date,
    setDate,
    title,
    setTitle,
    effort,
    setEffort,
    saveAsPreset,
    setSaveAsPreset,
    presetName,
    setPresetName,
    presetNameTouched,
    setPresetNameTouched,
    showOptionalDistance,
    setShowOptionalDistance,
    showOptionalDuration,
    setShowOptionalDuration,
    showMetricTooltip,
    setShowMetricTooltip,
    metricTooltip,
    setMetricTooltip,
    metricTooltipAcknowledged,
    setMetricTooltipAcknowledged,
    tooltipAlreadySeen,
    tooltipSeenKey,
    activityType,
    typeConfig,
    preference,
    defaultFields,
    optionalFields,
    filteredPresets,
    equipment,
    selectedEquipmentIds,
    setSelectedEquipmentIds,
    displayDistance,
    handleDistanceChange,
    addEquipment,
    usePreset,
    useCustom,
    save,
  };
}
