import { useNavigate } from "react-router-dom";

export default function HeaderLogo({
  withTagline = false,
}: {
  withTagline?: boolean;
}) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate("/")}
      className="flex flex-col items-center select-none cursor-pointer"
    >
      <h1 className="text-3xl tracking-tight">
        <span className="font-nunito font-bold text-movenotes-primary">
          Move
        </span>
        <span className="font-playfair italic text-movenotes-accent">
          Notes
        </span>
      </h1>

      {withTagline && (
        <p className="mt-1 text-sm text-movenotes-muted font-nunito">
          Move. Log. Reflect.
        </p>
      )}
    </div>
  );
}
