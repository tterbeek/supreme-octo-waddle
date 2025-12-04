import HeaderLogo from "../components/HeaderLogo";
import PublicTopNav from "../components/PublicTopNav";

export default function Terms() {
  return (
    <div className="min-h-screen bg-movenotes-bg py-10 px-4 relative">
      <PublicTopNav />
      <div className="flex justify-center mb-6">
        <HeaderLogo />
      </div>
      <div className="max-w-3xl mx-auto bg-movenotes-surface text-movenotes-text rounded-2xl shadow-sm p-8 leading-relaxed">
        <h1 className="text-3xl font-semibold mb-3 text-center text-movenotes-primary">
          Terms of Service
        </h1>
        <p className="text-sm text-movenotes-muted mb-8 text-center">
          Last updated: 9 November 2025
        </p>

        <p className="mb-6 leading-relaxed">
          Welcome to <strong>MoveNotes</strong> (“we”, “our”, “us”), a personal and
          mindful movement journal. By creating an account or using MoveNotes,
          you agree to these Terms of Service. Please read them carefully.
        </p>

        {/* 1. Using MoveNotes */}
        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          1. Using MoveNotes
        </h2>
        <p className="mb-4 leading-relaxed">
          MoveNotes helps you log and reflect on your daily movement — including
          runs, walks, rides, hikes, yoga, strength training, or any other
          activity you choose to record. You agree to use the app for
          <strong> personal, non-commercial purposes</strong>.
        </p>
        <p className="mb-4 leading-relaxed">
          MoveNotes does not provide medical or fitness advice. If you have
          health concerns, consult a qualified professional before starting or
          changing your exercise routine.
        </p>

        {/* 2. Account Registration */}
        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          2. Account Registration
        </h2>
        <p className="mb-4 leading-relaxed">
          To use MoveNotes, you must provide a valid email address. We use a{" "}
          <strong>passwordless email login</strong> method, which sends a
          one-time code to your email for authentication.
        </p>
        <p className="mb-4 leading-relaxed">
          If you choose to opt in to our newsletter, we may send occasional
          updates or movement inspiration. This is entirely optional and can be
          changed at any time in your settings.
        </p>

        {/* 3. User Conduct */}
        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          3. User Conduct
        </h2>
        <p className="mb-2 leading-relaxed">
          You agree not to use MoveNotes to:
        </p>
        <ul className="list-disc list-inside space-y-1 ml-4 text-movenotes-text">
          <li>Upload content that is harmful, illegal, or offensive</li>
          <li>Interfere with the security or functionality of the service</li>
          <li>Attempt to access accounts that are not your own</li>
          <li>Reverse-engineer or disrupt the platform</li>
        </ul>

        {/* 4. Privacy and Data */}
        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          4. Privacy and Data
        </h2>
        <p className="mb-4 leading-relaxed">
          MoveNotes is designed to collect as little personal information as
          possible. We store your email, activity entries (including optional
          notes and photos), and your preferences. We do not collect GPS
          location or health sensor data.
        </p>
        <p className="mb-4 leading-relaxed">
          For full details on how your information is handled, please read our{" "}
          <a
            href="/privacy"
            className="text-movenotes-accent underline hover:opacity-80"
          >
            Privacy Policy
          </a>
          .
        </p>

        {/* 5. Intellectual Property */}
        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          5. Intellectual Property
        </h2>
        <p className="mb-4 leading-relaxed">
          MoveNotes is open-source software. You retain full ownership of the
          content you create in the app, including your notes and photos. The
          MoveNotes name, logo, design, and branding remain our property.
        </p>

        {/* 6. Disclaimer */}
        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          6. Disclaimer of Warranties
        </h2>
        <p className="mb-4 leading-relaxed">
          MoveNotes is provided “as is,” without warranties of any kind. While
          we strive to keep the service stable, secure, and available, we cannot
          guarantee uninterrupted access or that all data will be preserved
          without error.
        </p>

        {/* 7. Limitation of Liability */}
        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          7. Limitation of Liability
        </h2>
        <p className="mb-4 leading-relaxed">
          To the extent permitted by law, MoveNotes and its contributors are not
          liable for any indirect, incidental, or consequential damages,
          including loss of data, loss of profits, or personal injury resulting
          from your use of the app.
        </p>

        {/* 8. Account Deletion */}
        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          8. Account Deletion
        </h2>
        <p className="mb-4 leading-relaxed">
          You may delete your account and request the removal of all associated
          data at any time, either through the app or by contacting us directly.
        </p>

        {/* 9. Changes to Terms */}
        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          9. Changes to These Terms
        </h2>
        <p className="mb-4 leading-relaxed">
          We may update these Terms as MoveNotes evolves. The most recent
          version will always be available at{" "}
          <a
            href="/terms"
            className="text-movenotes-accent underline hover:opacity-80"
          >
            movenotes.app/terms
          </a>
          . Major changes will be announced through the app or via email (if you
          opted in).
        </p>

        {/* 10. Contact */}
        <h2 className="text-xl font-semibold text-movenotes-primary mt-8 mb-2">
          10. Contact
        </h2>
        <p className="leading-relaxed">
          Questions about these Terms? Contact us at{" "}
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
