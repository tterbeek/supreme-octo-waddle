import { useNavigate } from "react-router-dom";
import { WORDMARK } from "../lib/brand";

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
        <span className="font-nunito font-bold text-movenotes-primary" style={{ fontFamily: WORDMARK.move.family, fontWeight: WORDMARK.move.weight, color: WORDMARK.move.color }}>
          {WORDMARK.move.text}
        </span>
        <span className="font-playfair italic text-movenotes-accent" style={{ fontFamily: WORDMARK.notes.family, fontWeight: WORDMARK.notes.weight, color: WORDMARK.notes.color }}>
          {WORDMARK.notes.text}
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
