import HeaderLogo from "../components/HeaderLogo";
import PublicTopNav from "../components/PublicTopNav";

export default function Support() {
  return (
    <div className="min-h-screen bg-movenotes-bg py-10 px-4 text-movenotes-text relative">
      <PublicTopNav />
      <div className="flex justify-center mb-6">
        <HeaderLogo />
      </div>

      <div className="max-w-3xl mx-auto bg-movenotes-surface shadow-sm rounded-2xl p-8">
        <h1 className="text-3xl font-semibold mb-3 text-center text-movenotes-primary">
          MoveNotes Support
        </h1>

        <p className="mb-6 leading-relaxed text-center">
          For help with MoveNotes or the Strava integration, contact:{" "}
          <a
            href="mailto:info@movenotes.app"
            className="text-movenotes-accent underline hover:opacity-80"
          >
            info@movenotes.app
          </a>
        </p>

        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          Common topics
        </h2>

        <ul className="list-disc list-inside space-y-1 ml-4 mb-6">
          <li>Connecting your Strava account</li>
          <li>Disconnecting Strava</li>
          <li>Importing activities</li>
          <li>Deleting your account and data</li>
        </ul>

        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          Strava connection help
        </h2>

        <p className="mb-4 leading-relaxed">
          Go to <strong>Settings</strong>, open <strong>Manage external data connections</strong>,
          and choose <strong>Connect with Strava</strong>. After authorizing in Strava,
          you will be redirected back to MoveNotes.
        </p>

        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          Disconnect instructions
        </h2>

        <p className="mb-4 leading-relaxed">
          To disconnect Strava, go to <strong>Settings</strong>, open
          <strong> Manage external data connections</strong>, then choose
          <strong> Disconnect</strong>. MoveNotes will stop importing new activities.
        </p>

        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          Legal information
        </h2>

        <ul className="list-disc list-inside space-y-1 ml-4">
          <li>
            <a href="/privacy" className="text-movenotes-accent underline hover:opacity-80">
              Privacy Policy
            </a>
          </li>
          <li>
            <a href="/terms" className="text-movenotes-accent underline hover:opacity-80">
              Terms of Service
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
