import { Link } from "react-router-dom";

export default function IntroPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-movenotes-bg text-movenotes-text">
      <div className="max-w-md w-full space-y-6 bg-movenotes-surface shadow-sm border border-movenotes-border rounded-2xl p-8">
        <h1 className="text-2xl font-semibold text-movenotes-primary">
          A private movement journal.
        </h1>

        <p className="text-movenotes-muted">
          MoveNotes is for people who want to remember how movement felt,
          not just what they did.
        </p>

        <ul className="space-y-2 text-movenotes-text">
          <li>• Log runs, walks, rides, yoga and more</li>
          <li>• Optional distance or duration</li>
          <li>• Notes and photos, just for you</li>
          <li>• Gentle goals and trends</li>
          <li>• No GPS, no feed, no pressure</li>
        </ul>

        <div className="space-y-3 pt-4">
          <Link
            to="/login"
            className="block w-full text-center rounded-full bg-movenotes-primary text-primary-text py-3 font-medium shadow-sm"
          >
            Try MoveNotes
          </Link>

          <Link
            to="/about"
            className="block text-center text-movenotes-accent underline font-medium"
          >
            Read why it exists
          </Link>
        </div>
      </div>
    </div>
  );
}
