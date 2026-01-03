import AddActivityForm from "./AddActivityForm";

type AddActivityModalProps = {
  initialType?: string;
  initialDate?: string;
  returnTo?: string;
  onClose: () => void;
  onLogged: (activityId: string) => void;
};

export default function AddActivityModal({
  initialType = "run",
  initialDate,
  returnTo,
  onClose,
  onLogged,
}: AddActivityModalProps) {
  return (
    <AddActivityForm
      initialType={initialType}
      initialDate={initialDate}
      returnTo={returnTo}
      onClose={onClose}
      onLogged={onLogged}
    />
  );
}
