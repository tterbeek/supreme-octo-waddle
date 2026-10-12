import AddActivityForm from "./AddActivityForm";
import type { ImportedActivity } from "../../lib/importedActivity";

type AddActivityModalProps = {
  initialType?: string;
  initialDate?: string;
  returnTo?: string;
  onClose: () => void;
  onLogged: (activityId: string) => void;
  existingActivity?: ImportedActivity;
};

export default function AddActivityModal({
  initialType = "run",
  initialDate,
  returnTo,
  onClose,
  onLogged,
  existingActivity,
}: AddActivityModalProps) {
  return (
    <AddActivityForm
      initialType={initialType}
      initialDate={initialDate}
      returnTo={returnTo}
      onClose={onClose}
      onLogged={onLogged}
      existingActivity={existingActivity}
    />
  );
}
