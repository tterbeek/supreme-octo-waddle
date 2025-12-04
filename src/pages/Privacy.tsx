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
          Last updated: 9 November 2025
        </p>

        <p className="mb-6 leading-relaxed">
          <strong>MoveNotes</strong> (“we”, “our”, “us”) is a personal,
          privacy-first movement journal. We collect only the minimum amount of
          data needed to make the app work — and nothing more.
        </p>

        {/* 1. Data We Collect */}
        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          1. Data We Collect
        </h2>

        <p className="mb-4 leading-relaxed">
          When you create an account, we collect your <strong>email address</strong>.
          This is used only for signing in through passwordless email codes and
          essential service communication.
        </p>

        <p className="mb-4 leading-relaxed">
          When you use the app, we store the activity entries you create:
        </p>
        <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
          <li>Activity type (e.g., run, walk, yoga, cycling)</li>
          <li>Distance or duration (if you choose to enter them)</li>
          <li>Optional notes and feelings</li>
          <li>Optional photos you upload</li>
          <li>Your goal settings and presets</li>
        </ul>

        <p className="mb-4 leading-relaxed">
          This information is private and visible only to you. We do not collect
          your GPS location, health sensor data, contacts, or any biometric data.
        </p>

        <p className="mb-4 leading-relaxed">
          If you choose to opt in to our newsletter during signup or in settings,
          we also store your <strong>newsletter preference</strong>.
        </p>

        <p className="mb-4 leading-relaxed">
          Basic technical information (such as IP address or browser type) may be
          processed temporarily to keep the service secure.
        </p>

        {/* 2. Why We Collect Your Data */}
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

        {/* 3. Data Storage & Security */}
        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          3. Data Storage & Security
        </h2>

        <p className="mb-4 leading-relaxed">
          Your data is stored securely using <strong>Supabase</strong> — a trusted
          open-source backend that provides encrypted storage, authentication, and
          database services.
        </p>

        <ul className="list-disc list-inside space-y-1 ml-4">
          <li>All data in transit is encrypted (HTTPS/TLS)</li>
          <li>Your photos are stored privately in Supabase Storage</li>
          <li>Your entries and media are accessible only to your account</li>
        </ul>

        <p className="mt-2 mb-4 leading-relaxed">
          MoveNotes does not access your images for any purpose other than storing
          them on your behalf.
        </p>

        {/* 4. Your Rights */}
        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          4. Your Rights
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

        {/* 5. Cookies & Analytics */}
        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          5. Cookies & Analytics
        </h2>

        <p className="mb-4 leading-relaxed">
          MoveNotes does not use advertising or tracking cookies. We use only a
          minimal session cookie that keeps you logged in securely. We do not use
          any third-party analytics tools that track personal behavior.
        </p>

        {/* 6. Third-Party Services */}
        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          6. Third-Party Services
        </h2>

        <p className="mb-4 leading-relaxed">
          We rely on Supabase (database, authentication, storage) and a trusted
          email provider for sending login codes. These providers process data
          solely on our behalf and must comply with strong privacy and security
          standards.
        </p>

        {/* 7. Changes */}
        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          7. Changes to This Policy
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
          . We will notify users of significant changes inside the app.
        </p>

        {/* 8. Contact */}
        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          8. Contact
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
      </div>
    </div>
  );
}
