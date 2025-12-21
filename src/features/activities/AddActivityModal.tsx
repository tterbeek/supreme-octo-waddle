import AddActivityForm from "./AddActivityForm";

type AddActivityModalProps = {
  initialType?: string;
  onClose: () => void;
  onLogged: (activityId: string) => void;
};

export default function AddActivityModal({
  initialType = "run",
  onClose,
  onLogged,
}: AddActivityModalProps) {
  return (
    <AddActivityForm
      initialType={initialType}
      onClose={onClose}
      onLogged={onLogged}
    />
  );
}
