import QuickLogForm2 from "../../components/QuickLogForm2";

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
    <QuickLogForm2
      initialType={initialType}
      onClose={onClose}
      onLogged={onLogged}
    />
  );
}
