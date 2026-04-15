export default function TermsOfService({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-[#1a2332]">Terms of Service</h2>
            <p className="text-xs text-gray-400 mt-0.5">LotLine Homes — Deal Flow Pro CRM</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-6 py-5 text-sm text-gray-700 space-y-5 leading-relaxed">
          <p className="text-xs text-gray-400">Last updated: April 15, 2026</p>

          <p>
            These Terms of Service ("Terms") govern your access to and use of the LotLine Homes Deal Flow Pro CRM platform
            ("the Platform"), operated by LotLine Homes ("Company," "we," "us," or "our"). By creating an account and
            accessing the Platform, you agree to be bound by these Terms.
          </p>

          <section>
            <h3 className="font-semibold text-[#1a2332] mb-1">1. Acceptance of Terms</h3>
            <p>
              By registering for an account or using any part of the Platform, you confirm that you are at least 18 years
              of age, have the authority to enter into this agreement on behalf of yourself or your organization, and agree
              to comply with these Terms and all applicable laws and regulations.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-[#1a2332] mb-1">2. Platform Access & User Accounts</h3>
            <p>
              Access to the Platform is granted by invitation or approval from a LotLine Homes administrator. You are
              responsible for maintaining the confidentiality of your login credentials. You must notify us immediately of
              any unauthorized use of your account. LotLine Homes reserves the right to suspend or terminate accounts that
              violate these Terms.
            </p>
            <p className="mt-2">
              User roles (Admin, Editor, Viewer) are assigned by your organization's administrator and determine what
              actions you may perform within the Platform. You agree not to attempt to exceed the permissions assigned to
              your role.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-[#1a2332] mb-1">3. Confidentiality of Deal Data</h3>
            <p>
              All deal information, seller contacts, property data, financial projections, and pipeline information entered
              into or accessed through the Platform is strictly confidential. You agree not to share, export, reproduce, or
              disclose any data obtained through the Platform with unauthorized third parties without prior written consent
              from LotLine Homes.
            </p>
            <p className="mt-2">
              This obligation of confidentiality survives termination of your account or these Terms.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-[#1a2332] mb-1">4. Acceptable Use</h3>
            <p>You agree to use the Platform only for lawful business purposes related to land acquisition and real estate
              deal management. You must not:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Use the Platform to store or process data unrelated to LotLine Homes business activities</li>
              <li>Attempt to reverse-engineer, copy, or replicate the Platform's functionality</li>
              <li>Use automated scripts, bots, or scraping tools against the Platform</li>
              <li>Input false, misleading, or fraudulent deal or contact information</li>
              <li>Share your account credentials with others not authorized by an administrator</li>
              <li>Use the Platform in any manner that could damage, disable, or impair its operation</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-[#1a2332] mb-1">5. Data Ownership</h3>
            <p>
              All deal data, contacts, and records entered into the Platform remain the property of LotLine Homes. You
              acknowledge that you are entering data on behalf of LotLine Homes and that no personal ownership rights over
              that data are granted by your use of the Platform.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-[#1a2332] mb-1">6. Privacy & Data Security</h3>
            <p>
              LotLine Homes takes reasonable technical and organizational measures to protect data stored within the
              Platform. However, no system is completely secure. You are responsible for maintaining secure access to your
              account and for reporting any suspected security breach immediately to your administrator.
            </p>
            <p className="mt-2">
              Personal information you provide during registration (name, email, phone number, company) will be used solely
              to manage your account and facilitate your access to the Platform. We do not sell personal information to
              third parties.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-[#1a2332] mb-1">7. Intellectual Property</h3>
            <p>
              The Platform, including its design, features, workflows, and underlying code, is the exclusive property of
              LotLine Homes. Nothing in these Terms grants you any ownership or license in the Platform beyond the limited
              right to use it as authorized by your role.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-[#1a2332] mb-1">8. Termination</h3>
            <p>
              LotLine Homes may suspend or terminate your account at any time for violation of these Terms, upon
              termination of your employment or engagement with LotLine Homes, or at the discretion of an administrator.
              Upon termination, your access to the Platform and all data therein will be revoked immediately.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-[#1a2332] mb-1">9. Limitation of Liability</h3>
            <p>
              To the maximum extent permitted by law, LotLine Homes shall not be liable for any indirect, incidental,
              special, or consequential damages arising from your use of or inability to use the Platform, even if advised
              of the possibility of such damages. The Platform is provided "as is" and we make no warranties, express or
              implied, regarding its availability or accuracy.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-[#1a2332] mb-1">10. Changes to These Terms</h3>
            <p>
              LotLine Homes reserves the right to update these Terms at any time. We will notify users of material changes
              via the Platform or by email. Continued use of the Platform after changes are posted constitutes your
              acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-[#1a2332] mb-1">11. Governing Law</h3>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the state in which LotLine
              Homes is incorporated, without regard to its conflict of law provisions. Any disputes arising under these
              Terms shall be resolved in the courts of competent jurisdiction in that state.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-[#1a2332] mb-1">12. Contact</h3>
            <p>
              If you have questions about these Terms, please contact your LotLine Homes administrator or reach out to us
              directly through official company channels.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ backgroundColor: '#c9703a' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
