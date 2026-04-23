import MarketingLayout from '../../components/marketing/MarketingLayout';

const EFFECTIVE_DATE = 'January 1, 2025';
const COMPANY = 'LotLine Homes LLC';
const EMAIL = 'support@lotlinehomes.com';

function Section({ title, children }) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-bold text-sidebar mb-3">{title}</h2>
      <div className="text-gray-600 leading-relaxed space-y-3 text-sm">{children}</div>
    </div>
  );
}

export default function Terms() {
  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="pt-32 pb-10" style={{ background: '#1a2332' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="text-xs font-semibold uppercase tracking-widest text-accent">Legal</span>
          <h1 className="text-4xl font-bold text-white mt-3 mb-2">Terms of Service</h1>
          <p className="text-white/45 text-sm">Effective date: {EFFECTIVE_DATE}</p>
        </div>
      </section>

      <section className="py-14 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Section title="1. Agreement to Terms">
            <p>
              By accessing or using LotLine DealFlow Pro (the "Service"), you agree to be bound by these Terms
              of Service. If you do not agree to these terms, do not use the Service.
            </p>
            <p>
              The Service is operated by {COMPANY} ("we," "us," or "our"). These Terms apply to all visitors,
              users, and others who access or use the Service.
            </p>
          </Section>

          <Section title="2. Use of the Service">
            <p>
              You may use the Service only for lawful purposes and in accordance with these Terms. You agree not
              to use the Service:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>In any way that violates applicable federal, state, local, or international law or regulation.</li>
              <li>To transmit any unsolicited or unauthorized advertising or promotional material.</li>
              <li>To impersonate or attempt to impersonate {COMPANY}, a {COMPANY} employee, or another user.</li>
              <li>To engage in any conduct that restricts or inhibits anyone's use or enjoyment of the Service.</li>
            </ul>
          </Section>

          <Section title="3. Accounts and Security">
            <p>
              You are responsible for maintaining the confidentiality of your account credentials and for all
              activities that occur under your account. You agree to notify us immediately at {EMAIL} of any
              unauthorized use of your account.
            </p>
            <p>
              You must provide accurate, current, and complete information during registration and keep that
              information updated.
            </p>
          </Section>

          <Section title="4. Subscriptions and Billing">
            <p>
              Paid plans are billed on a monthly or annual basis. Your subscription renews automatically at the
              end of each billing period unless cancelled. You may cancel at any time; access continues through
              the end of the current billing period. No refunds are issued for partial billing periods.
            </p>
            <p>
              We reserve the right to change our pricing with 30 days' advance notice to subscribers.
            </p>
          </Section>

          <Section title="5. Your Data">
            <p>
              You retain ownership of all data you input into the Service ("Your Content"). By using the
              Service, you grant {COMPANY} a limited license to store, process, and display Your Content solely
              to provide the Service to you.
            </p>
            <p>
              We do not sell Your Content to third parties or use it for any purpose beyond operating and
              improving the Service.
            </p>
          </Section>

          <Section title="6. Intellectual Property">
            <p>
              The Service and its original content, features, and functionality are and will remain the
              exclusive property of {COMPANY}. Our name, logo, and product names are trademarks of {COMPANY}.
              You may not use them without our prior written consent.
            </p>
          </Section>

          <Section title="7. Limitation of Liability">
            <p>
              To the maximum extent permitted by law, {COMPANY} shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages, including without limitation loss of
              profits, data, or goodwill, arising out of or in connection with your use of the Service.
            </p>
            <p>
              Our total liability to you for any claim arising from these Terms or your use of the Service
              shall not exceed the amount you paid us in the 12 months preceding the claim.
            </p>
          </Section>

          <Section title="8. Disclaimer of Warranties">
            <p>
              The Service is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind,
              express or implied, including but not limited to merchantability, fitness for a particular
              purpose, or non-infringement.
            </p>
          </Section>

          <Section title="9. Termination">
            <p>
              We may terminate or suspend your account at any time, with or without cause, with or without
              notice. Upon termination, your right to use the Service ceases immediately. Sections of these
              Terms that by their nature should survive termination shall survive.
            </p>
          </Section>

          <Section title="10. Governing Law">
            <p>
              These Terms shall be governed by the laws of the State of Georgia, without regard to its conflict
              of law provisions. Any disputes shall be resolved in the courts located in Georgia.
            </p>
          </Section>

          <Section title="11. Changes to Terms">
            <p>
              We reserve the right to modify these Terms at any time. We will provide at least 30 days' notice
              of material changes by email or in-app notification. Continued use of the Service after changes
              take effect constitutes acceptance of the revised Terms.
            </p>
          </Section>

          <Section title="12. Contact Us">
            <p>
              Questions about these Terms? Contact us at{' '}
              <a href={`mailto:${EMAIL}`} className="text-accent hover:underline">{EMAIL}</a>.
            </p>
          </Section>
        </div>
      </section>
    </MarketingLayout>
  );
}
