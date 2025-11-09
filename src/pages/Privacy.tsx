export default function Privacy() {
  return (
    <div className="min-h-screen bg-movenotes-bg py-10 px-4 text-movenotes-text">
      <div className="max-w-3xl mx-auto bg-movenotes-surface shadow-sm rounded-2xl p-8">
        <h1 className="text-3xl font-semibold mb-3 text-center text-movenotes-primary">
          MoveNotes Privacy Policy
        </h1>
        <p className="text-sm text-movenotes-muted mb-8 text-center">
          Last updated: 9 November 2025
        </p>

        <p className="mb-6 leading-relaxed">
          <strong>MoveNotes</strong> (“we”, “our”, “us”) is a personal,
          privacy-first activity tracking app. We collect only the minimum
          amount of data needed to make the app work — and nothing more.
        </p>

        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          1. Data We Collect
        </h2>
        <p className="mb-4 leading-relaxed">
          When you create an account, we collect your email address. This is
          used only for authentication and essential account communication (for
          example, password resets). We do not request your name, location, or
          any other personal details.
        </p>
        <p className="mb-4 leading-relaxed">
          Basic technical information (like browser type and IP address) may be
          stored temporarily to keep the app secure and reliable.
        </p>

        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          2. Why We Collect Your Data
        </h2>
        <p className="mb-2">We process your email and data to:</p>
        <ul className="list-disc list-inside space-y-1 ml-4">
          <li>Create and maintain your MoveNotes account</li>
          <li>Authenticate you when you sign in</li>
          <li>Allow you to save and access your entries securely</li>
          <li>Communicate essential updates (like password resets)</li>
        </ul>
        <p className="mt-2 mb-4 leading-relaxed">
          We do not use your email for marketing, and we do not sell or share
          your data with advertisers.
        </p>

        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          3. Data Storage & Security
        </h2>
        <p className="mb-4 leading-relaxed">
          Your data is stored securely using{" "}
          <strong>Supabase</strong> — a trusted open-source backend provider that
          follows strong encryption and security practices.
        </p>
        <ul className="list-disc list-inside space-y-1 ml-4">
          <li>All data in transit is encrypted (HTTPS/TLS)</li>
          <li>Passwords are securely hashed, never stored in plain text</li>
          <li>Your entries are private and visible only to you</li>
        </ul>

        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          4. Your Rights
        </h2>
        <p className="mb-2">You can:</p>
        <ul className="list-disc list-inside space-y-1 ml-4">
          <li>Access your stored data</li>
          <li>Delete your account at any time</li>
          <li>Request removal of your data from our servers</li>
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
          5. Cookies & Analytics
        </h2>
        <p className="mb-4 leading-relaxed">
          MoveNotes does not use advertising or tracking cookies. We may use a
          minimal session cookie to keep you logged in securely. We don’t use
          third-party analytics that track personal behavior.
        </p>

        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          6. Third-Party Services
        </h2>
        <p className="mb-4 leading-relaxed">
          If we use third-party tools (for example, email delivery through
          Supabase), we ensure they meet strong privacy and security standards.
          They process data only under our direction.
        </p>

        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          7. Changes to This Policy
        </h2>
        <p className="mb-4 leading-relaxed">
          We may update this Privacy Policy as the app evolves. The latest
          version will always be available at{" "}
          <a
            href="/privacy"
            className="text-movenotes-accent underline hover:opacity-80"
          >
            movenotes.app/privacy
          </a>
          . Significant changes will be announced through the app.
        </p>

        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          8. Contact
        </h2>
        <p className="leading-relaxed">
          For privacy-related questions, reach us at{" "}
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
