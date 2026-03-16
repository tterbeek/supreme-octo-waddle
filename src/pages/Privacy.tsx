import HeaderLogo from "../components/HeaderLogo";
import PublicTopNav from "../components/PublicTopNav";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-movenotes-bg py-10 px-4 text-movenotes-text relative">
      <PublicTopNav />
      <div className="flex justify-center mb-6">
        <HeaderLogo />
      </div>
      <div className="max-w-3xl mx-auto bg-movenotes-surface shadow-sm rounded-2xl p-8">
        <h1 className="text-3xl font-semibold mb-3 text-center text-movenotes-primary">
          Privacy Policy
        </h1>
        <p className="text-sm text-movenotes-muted mb-8 text-center">
          Last updated: 16 March 2026
        </p>

        <p className="mb-6 leading-relaxed">
          <strong>MoveNotes</strong> ("we", "our", "us") is a personal,
          privacy-first movement journal. We collect only the minimum amount of
          data needed to make the app work.
        </p>

        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          1. Information We Store
        </h2>

        <p className="mb-4 leading-relaxed">
          MoveNotes stores the following information to provide the service:
        </p>

        <p className="mb-2 leading-relaxed">
          <strong>Account information</strong>
        </p>
        <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
          <li>Email address</li>
          <li>Authentication identifiers</li>
        </ul>

        <p className="mb-2 leading-relaxed">
          <strong>Activity information</strong>
        </p>
        <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
          <li>Activity name</li>
          <li>Activity type</li>
          <li>Start date and time</li>
          <li>Distance</li>
          <li>Duration</li>
        </ul>

        <p className="mb-2 leading-relaxed">
          <strong>User-generated reflections</strong>
        </p>
        <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
          <li>Perceived effort</li>
          <li>Feeling rating</li>
          <li>Written notes</li>
          <li>Optional photos you upload</li>
        </ul>

        <p className="mb-4 leading-relaxed">
          We also store app preferences and settings required to provide the service.
          If you choose to opt in to our newsletter, we also store your newsletter
          preference.
        </p>

        <p className="mb-4 leading-relaxed">
          Basic technical information (such as IP address or browser type) may be
          processed temporarily to keep the service secure.
        </p>

        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          2. Why We Collect Your Data
        </h2>

        <p className="mb-2">We process your information to:</p>

        <ul className="list-disc list-inside space-y-1 ml-4">
          <li>Create and maintain your account</li>
          <li>Authenticate you using passwordless email codes</li>
          <li>Allow you to save and retrieve your activity history</li>
          <li>Store notes and photos you choose to add</li>
          <li>Provide optional email updates if you opted in</li>
        </ul>

        <p className="mt-2 mb-4 leading-relaxed">
          We never sell or share your data with advertisers. Your information is
          not used for profiling, targeted advertising, or public social features.
        </p>

        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          3. Use of Strava Data
        </h2>

        <p className="mb-4 leading-relaxed">
          MoveNotes allows users to connect their Strava account in order to import
          activity summaries.
        </p>

        <p className="mb-2 leading-relaxed">
          When a user connects Strava, MoveNotes may access the following information
          via the Strava API:
        </p>
        <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
          <li>Activity name</li>
          <li>Activity type</li>
          <li>Start date and time</li>
          <li>Duration</li>
          <li>Distance</li>
        </ul>

        <p className="mb-4 leading-relaxed">
          This information is used solely to create activity entries within the
          MoveNotes training journal.
        </p>

        <p className="mb-4 leading-relaxed">
          MoveNotes does not store GPS tracks, segment data, or other detailed
          performance analytics from Strava.
        </p>

        <p className="mb-4 leading-relaxed">
          MoveNotes does not sell, rent, or redistribute Strava data.
        </p>

        <p className="mb-4 leading-relaxed">
          Users may disconnect their Strava account at any time in the application
          settings. When a Strava account is disconnected, MoveNotes will stop
          importing new activities.
        </p>

        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          4. Sensitive Data
        </h2>

        <p className="mb-4 leading-relaxed">
          MoveNotes does not intentionally collect sensitive personal data such as
          biometric identifiers, financial data, or medical records.
        </p>

        <p className="mb-4 leading-relaxed">
          Reflections entered by users may contain personal information voluntarily
          provided by the user.
        </p>

        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          5. Data Storage and Security
        </h2>

        <p className="mb-4 leading-relaxed">
          Your data is stored securely using <strong>Supabase</strong>, which provides
          encrypted storage, authentication, and database services.
        </p>

        <ul className="list-disc list-inside space-y-1 ml-4">
          <li>All data in transit is encrypted (HTTPS/TLS)</li>
          <li>Your photos are stored privately in Supabase Storage</li>
          <li>Your entries and media are accessible only to your account</li>
        </ul>

        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          6. Data Retention and Deletion
        </h2>

        <p className="mb-4 leading-relaxed">
          Users may delete their account at any time.
        </p>

        <p className="mb-4 leading-relaxed">
          Deleting an account permanently removes associated activity data and
          reflections from MoveNotes servers within a reasonable period.
        </p>

        <p className="mb-4 leading-relaxed">
          Users may also disconnect third-party integrations such as Strava from
          the application settings.
        </p>

        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          7. Your Rights
        </h2>

        <p className="mb-2">You have the right to:</p>

        <ul className="list-disc list-inside space-y-1 ml-4">
          <li>Access and export your stored activity data</li>
          <li>Delete your account at any time</li>
          <li>Request complete removal of your data from our servers</li>
          <li>Withdraw newsletter consent at any time</li>
        </ul>

        <p className="mt-2 mb-4 leading-relaxed">
          To exercise these rights, contact us at{" "}
          <a
            href="mailto:privacy@movenotes.app"
            className="text-movenotes-accent underline hover:opacity-80"
          >
            privacy@movenotes.app
          </a>
          .
        </p>

        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          8. Cookies and Analytics
        </h2>

        <p className="mb-4 leading-relaxed">
          MoveNotes does not use advertising or tracking cookies. We use only a
          minimal session cookie that keeps you logged in securely. We do not use
          third-party analytics tools that track personal behavior.
        </p>

        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          9. Third-Party Services
        </h2>

        <p className="mb-4 leading-relaxed">
          We rely on Supabase (database, authentication, storage) and a trusted
          email provider for sending login codes. These providers process data
          solely on our behalf and must comply with strong privacy and security
          standards.
        </p>

        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          10. Changes to This Policy
        </h2>

        <p className="mb-4 leading-relaxed">
          We may update this Privacy Policy if MoveNotes evolves. The most recent
          version will always be available at{" "}
          <a
            href="/privacy"
            className="text-movenotes-accent underline hover:opacity-80"
          >
            movenotes.app/privacy
          </a>
          .
        </p>

        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          11. Contact
        </h2>

        <p className="leading-relaxed">
          For privacy questions, contact us at{" "}
          <a
            href="mailto:privacy@movenotes.app"
            className="text-movenotes-accent underline hover:opacity-80"
          >
            privacy@movenotes.app
          </a>{" "}
          or{" "}
          <a
            href="mailto:info@movenotes.app"
            className="text-movenotes-accent underline hover:opacity-80"
          >
            info@movenotes.app
          </a>
          .
        </p>

        <p className="mt-8 text-sm text-movenotes-muted">
          Strava is a registered trademark of Strava, Inc. MoveNotes is not
          affiliated with or endorsed by Strava.
        </p>
      </div>
    </div>
  );
}
