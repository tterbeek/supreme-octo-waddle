export default function Terms() {
  return (
    <div className="min-h-screen bg-movenotes-bg py-10 px-4">
      <div className="max-w-3xl mx-auto bg-movenotes-surface text-movenotes-text rounded-2xl shadow-sm p-8 leading-relaxed">
        <h1 className="text-3xl font-semibold mb-3 text-center text-movenotes-primary">
          MoveNotes Terms of Service
        </h1>
        <p className="text-sm text-movenotes-muted mb-8 text-center">
          Last updated: 9 November 2025
        </p>

        <p className="mb-6 leading-relaxed">
          Welcome to <strong>MoveNotes</strong> (“we”, “our”, “us”), a mindful,
          personal activity tracking app. By accessing or using MoveNotes, you
          agree to these Terms of Service.
        </p>

        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          1. Using MoveNotes
        </h2>
        <p className="mb-4 leading-relaxed">
          MoveNotes lets you record and reflect on your activities — runs, rides,
          or walks — and keep notes about how you felt. You agree to use the app
          responsibly and for personal tracking only.
        </p>

        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          2. Account Registration
        </h2>
        <p className="mb-4 leading-relaxed">
          You’ll need a valid email address to create an account. This email is
          used only for authentication, password resets, and important notices
          about your account.
        </p>

        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          3. User Conduct
        </h2>
        <p className="mb-2 leading-relaxed">
          You agree not to use MoveNotes to:
        </p>
        <ul className="list-disc list-inside space-y-1 ml-4 text-movenotes-text">
          <li>Upload harmful, illegal, or offensive content</li>
          <li>Attempt to access another user’s data</li>
          <li>Violate any applicable laws or rights of others</li>
        </ul>

        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          4. Privacy and Data
        </h2>
        <p className="mb-4 leading-relaxed">
          We collect only the data required to make MoveNotes work — your email
          and the notes you choose to record. For details on how your data is
          handled, please see our{" "}
          <a
            href="/privacy"
            className="text-movenotes-accent underline hover:opacity-80"
          >
            Privacy Policy
          </a>
          .
        </p>

        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          5. Intellectual Property
        </h2>
        <p className="mb-4 leading-relaxed">
          MoveNotes is open-source software. You retain full ownership of your
          personal data and entries. The MoveNotes name, logo, and interface
          remain our property.
        </p>

        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          6. Disclaimer of Warranties
        </h2>
        <p className="mb-4 leading-relaxed">
          MoveNotes is provided “as is” — we make no guarantees about uptime,
          performance, or data accuracy. We do our best to keep it stable and
          secure, but you use the service at your own risk.
        </p>

        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          7. Limitation of Liability
        </h2>
        <p className="mb-4 leading-relaxed">
          To the extent permitted by law, MoveNotes and its contributors are not
          liable for any loss or damages resulting from your use of the app.
        </p>

        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          8. Changes to Terms
        </h2>
        <p className="mb-4 leading-relaxed">
          We may occasionally update these Terms. The most recent version will
          always be available at{" "}
          <a
            href="/terms"
            className="text-movenotes-accent underline hover:opacity-80"
          >
            movenotes.app/terms
          </a>
          . Major updates will be communicated through the app or via email.
        </p>

        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          9. Contact
        </h2>
        <p className="leading-relaxed">
          Questions about these Terms? Reach us at{" "}
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
