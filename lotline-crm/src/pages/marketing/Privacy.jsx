import MarketingLayout from '../../components/marketing/MarketingLayout';

const EFFECTIVE_DATE = 'January 1, 2025';
const EMAIL = 'support@lotlinehomes.com';
const COMPANY = 'LotLine Homes LLC';

function Section({ title, children }) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-bold text-sidebar mb-3">{title}</h2>
      <div className="text-gray-600 leading-relaxed space-y-3 text-sm">{children}</div>
    </div>
  );
}

export default function Privacy() {
  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="pt-32 pb-10" style={{ background: '#1a2332' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="text-xs font-semibold uppercase tracking-widest text-accent">Legal</span>
          <h1 className="text-4xl font-bold text-white mt-3 mb-2">Privacy Policy</h1>
          <p className="text-white/45 text-sm">Effective date: {EFFECTIVE_DATE}</p>
        </div>
      </section>

      <section className="py-14 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-sm text-gray-500 leading-relaxed mb-10 p-4 bg-cream rounded-xl border border-card">
            Your privacy matters. This policy explains what information we collect, how we use it, and the
            choices you have. We don't sell your data — ever.
          </p>

          <Section title="1. Information We Collect">
            <p><strong className="text-gray-800">Account information:</strong> When you create an account, we collect your name, email address, company name, and phone number.</p>
            <p><strong className="text-gray-800">Deal and business data:</strong> All content you enter into the Service — deals, investor records, documents, financial figures — is stored and processed to provide the Service to you.</p>
            <p><strong className="text-gray-800">Usage data:</strong> We collect information about how you use the Service, including pages visited, features used, and time spent. This helps us improve the product.</p>
            <p><strong className="text-gray-800">Payment information:</strong> Billing is handled by our payment processor. We do not store full credit card numbers on our servers.</p>
            <p><strong className="text-gray-800">Communications:</strong> If you contact us by email or through the contact form, we retain that correspondence.</p>
          </Section>

          <Section title="2. How We Use Your Information">
            <ul className="list-disc pl-5 space-y-1">
              <li>To provide, maintain, and improve the Service.</li>
              <li>To process transactions and send billing-related communications.</li>
              <li>To respond to your inquiries and provide customer support.</li>
              <li>To send product updates, security alerts, and administrative messages.</li>
              <li>To detect and prevent fraudulent or unauthorized activity.</li>
              <li>To comply with legal obligations.</li>
            </ul>
            <p>We do not sell, rent, or trade your personal information or business data to any third party.</p>
          </Section>

          <Section title="3. Data Sharing">
            <p>We share your information only in the following limited circumstances:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-gray-800">Service providers:</strong> We use trusted third-party vendors (e.g., cloud hosting, payment processing, email delivery) who process data on our behalf under strict confidentiality agreements.</li>
              <li><strong className="text-gray-800">Legal requirements:</strong> We may disclose information if required to do so by law or in response to valid legal process.</li>
              <li><strong className="text-gray-800">Business transfers:</strong> In the event of a merger or acquisition, your information may be transferred as part of that transaction. We will notify you beforehand.</li>
            </ul>
          </Section>

          <Section title="4. Data Retention">
            <p>
              We retain your account information and business data for as long as your account is active. If you
              delete your account, we will delete or anonymize your data within 30 days, except where we are
              required by law to retain it longer.
            </p>
          </Section>

          <Section title="5. Security">
            <p>
              We implement industry-standard security measures including encryption in transit (TLS), encryption
              at rest, access controls, and regular security reviews. We use Supabase for our database
              infrastructure, which enforces row-level security policies to ensure each organization's data is
              isolated from others.
            </p>
            <p>
              No method of transmission over the internet is 100% secure. We cannot guarantee absolute security
              but we take reasonable measures to protect your information.
            </p>
          </Section>

          <Section title="6. Cookies and Tracking">
            <p>
              We use cookies and similar technologies to maintain your session and remember your preferences. We
              do not use third-party advertising cookies. You can configure your browser to refuse cookies, but
              some features of the Service may not function properly without them.
            </p>
          </Section>

          <Section title="7. Your Rights">
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Access the personal information we hold about you.</li>
              <li>Correct inaccurate information.</li>
              <li>Request deletion of your account and associated data.</li>
              <li>Export your data in a portable format.</li>
              <li>Opt out of non-essential communications.</li>
            </ul>
            <p>To exercise any of these rights, email us at <a href={`mailto:${EMAIL}`} className="text-accent hover:underline">{EMAIL}</a>.</p>
          </Section>

          <Section title="8. Children's Privacy">
            <p>
              The Service is not directed to individuals under the age of 18. We do not knowingly collect
              personal information from children. If you become aware that a child has provided us with personal
              information, please contact us.
            </p>
          </Section>

          <Section title="9. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material changes by
              email or through the Service at least 30 days before they take effect.
            </p>
          </Section>

          <Section title="10. Contact">
            <p>
              Questions about this Privacy Policy? Reach us at{' '}
              <a href={`mailto:${EMAIL}`} className="text-accent hover:underline">{EMAIL}</a> or by mail at:
            </p>
            <p className="bg-cream rounded-xl p-4 border border-card font-mono text-xs text-gray-600">
              {COMPANY}<br />
              Attn: Privacy<br />
              support@lotlinehomes.com
            </p>
          </Section>
        </div>
      </section>
    </MarketingLayout>
  );
}
