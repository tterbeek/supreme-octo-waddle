import { useState } from "react";

export function useHomeModals() {
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [editActivity, setEditActivity] = useState<any | null>(null);

  return {
    showTypeSelector,
    setShowTypeSelector,
    selectedType,
    setSelectedType,
    showQuickLog,
    setShowQuickLog,
    editActivity,
    setEditActivity,
  };
}
