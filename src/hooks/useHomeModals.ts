import { useState } from "react";

export function useHomeModals() {
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [editActivity, setEditActivity] = useState<any | null>(null);

  return {
    showAddSheet,
    setShowAddSheet,
    selectedType,
    setSelectedType,
    showQuickLog,
    setShowQuickLog,
    editActivity,
    setEditActivity,
  };
}
