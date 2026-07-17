import type { ReactNode } from "react"

export type LegalDoc = {
  slug: string
  title: string
  /** One-line meta description. */
  description: string
  updated: string
  Body: () => ReactNode
}

const CONTACT = "legal@tacto.fyi"
const PRIVACY_CONTACT = "privacy@tacto.fyi"
const SECURITY_CONTACT = "security@tacto.fyi"

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: "terms",
    title: "Terms of Service",
    description: "The terms that govern your use of Tacto — accounts, acceptable use, subscriptions, content ownership, and liability.",
    updated: "2026-06-01",
    Body: () => (
      <>
        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of Tacto (the &ldquo;Service&rdquo;),
          operated by Tacto. By creating an account or using the Service, you agree to these Terms. If you are using
          Tacto on behalf of an organization, you agree on its behalf and represent that you have authority to do so.
        </p>
        <h2>1. Your account</h2>
        <p>
          You must provide accurate information when you create an account and keep it current. You are responsible for
          activity under your account and for keeping your credentials secure. Notify us promptly of any unauthorized use.
        </p>
        <h2>2. Acceptable use</h2>
        <p>You agree not to use the Service to:</p>
        <ul>
          <li>break the law or infringe anyone&apos;s rights, including intellectual property and privacy rights;</li>
          <li>upload malware, or attempt to disrupt, probe, or reverse-engineer the Service;</li>
          <li>capture or publish content you don&apos;t have the right to share, including others&apos; confidential data;</li>
          <li>resell or provide the Service to third parties except as expressly permitted.</li>
        </ul>
        <h2>3. Your content</h2>
        <p>
          You retain ownership of the recordings, guides, and other content you create with Tacto (&ldquo;Your
          Content&rdquo;). You grant us a limited license to host, process, and display Your Content solely to operate
          and improve the Service. You are responsible for Your Content and for having the rights to it.
        </p>
        <h2>4. Subscriptions and billing</h2>
        <p>
          Paid plans are billed in advance on a recurring basis. You can cancel anytime; cancellation takes effect at
          the end of the current billing period, and you keep paid features until then. Fees are non-refundable except
          as described in our refund policy or required by law.
        </p>
        <h2>5. Intellectual property</h2>
        <p>
          The Service, including its software, design, and trademarks, is owned by Tacto and protected by law. These
          Terms grant you no rights to our intellectual property except the limited right to use the Service.
        </p>
        <h2>6. Termination</h2>
        <p>
          You may stop using the Service at any time. We may suspend or terminate access if you materially breach these
          Terms or use the Service in a way that risks harm to others or to the Service. On termination, your right to
          use the Service ends; you may export Your Content before your account is closed.
        </p>
        <h2>7. Disclaimers and liability</h2>
        <p>
          The Service is provided &ldquo;as is&rdquo; without warranties of any kind. To the maximum extent permitted by
          law, Tacto is not liable for indirect, incidental, or consequential damages, and our total liability is limited
          to the amount you paid us in the twelve months before the claim.
        </p>
        <h2>8. Changes</h2>
        <p>
          We may update these Terms from time to time. If we make material changes, we&apos;ll notify you. Continued use
          after changes take effect means you accept the updated Terms.
        </p>
        <h2>9. Contact</h2>
        <p>
          Questions about these Terms? Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>
      </>
    ),
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    description: "How Tacto collects, uses, and protects your personal data — and the rights you have over it.",
    updated: "2026-06-01",
    Body: () => (
      <>
        <p>
          This Privacy Policy explains what personal data Tacto collects, how we use it, and the choices you have. We aim
          to collect only what we need to run the Service well.
        </p>
        <h2>Data we collect</h2>
        <ul>
          <li><strong>Account data</strong> — your name, email, and workspace details when you sign up.</li>
          <li><strong>Content</strong> — the recordings, screenshots, and guides you create.</li>
          <li><strong>Usage data</strong> — how you interact with the Service, for reliability and product improvement.</li>
          <li><strong>Billing data</strong> — processed by our payment provider; we don&apos;t store full card numbers.</li>
        </ul>
        <h2>How we use data</h2>
        <p>We use personal data to provide and secure the Service, process payments, respond to support requests, send
          important service communications, and improve the product. We do not sell your personal data.</p>
        <h2>Screenshots and PII</h2>
        <p>
          Because Tacto captures screenshots, your recordings may contain personal or sensitive information visible on
          screen. You control what you capture and publish, and we provide redaction tools to blur sensitive regions.
          Review guides before sharing them.
        </p>
        <h2>Sharing</h2>
        <p>
          We share data with service providers (such as hosting, analytics, and payment processors) under agreements
          that require them to protect it, and when required by law. Guides you publish are shared according to the
          visibility you choose.
        </p>
        <h2>Retention</h2>
        <p>
          We keep personal data for as long as your account is active or as needed to provide the Service, then delete or
          anonymize it, subject to legal obligations.
        </p>
        <h2>Your rights</h2>
        <p>
          Depending on where you live, you may have rights to access, correct, export, or delete your personal data, and
          to object to certain processing. To exercise these, email <a href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>.
          See also our <a href="/legal/gdpr">GDPR</a> page.
        </p>
        <h2>Contact</h2>
        <p>
          Privacy questions? Email <a href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>.
        </p>
      </>
    ),
  },
  {
    slug: "cookies",
    title: "Cookie Policy",
    description: "What cookies and similar technologies Tacto uses, and how to control them.",
    updated: "2026-06-01",
    Body: () => (
      <>
        <p>
          This Cookie Policy explains how Tacto uses cookies and similar technologies when you visit our website or use
          the Service.
        </p>
        <h2>What cookies are</h2>
        <p>
          Cookies are small text files stored on your device. They let a site remember your actions and preferences over
          time, and help us understand how the site is used.
        </p>
        <h2>How we use them</h2>
        <ul>
          <li><strong>Essential</strong> — required to sign in, keep you logged in, and secure the Service.</li>
          <li><strong>Preferences</strong> — remember choices like theme and language.</li>
          <li><strong>Analytics</strong> — help us understand usage so we can improve the product, in aggregate.</li>
        </ul>
        <p>We do not use cookies to sell your data or to serve third-party advertising.</p>
        <h2>Managing cookies</h2>
        <p>
          You can control or delete cookies through your browser settings. Blocking essential cookies may prevent parts
          of the Service from working. Where required, we ask for your consent to non-essential cookies.
        </p>
        <h2>Contact</h2>
        <p>
          Questions about cookies? Email <a href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>.
        </p>
      </>
    ),
  },
  {
    slug: "gdpr",
    title: "GDPR",
    description: "How Tacto supports compliance with the EU General Data Protection Regulation, including your rights and our role as processor.",
    updated: "2026-06-01",
    Body: () => (
      <>
        <p>
          Tacto is committed to supporting our customers&apos; compliance with the EU General Data Protection Regulation
          (GDPR) and equivalent laws. This page summarizes our approach.
        </p>
        <h2>Roles</h2>
        <p>
          For the personal data in the guides and recordings you create, you are the <strong>data controller</strong> and
          Tacto acts as a <strong>data processor</strong>, processing that data on your instructions. For your account
          and billing information, Tacto is the controller.
        </p>
        <h2>Your rights</h2>
        <p>
          If your personal data is processed by Tacto, you have the right to access, rectify, erase, restrict, and port
          it, and to object to certain processing. Submit a request to <a href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>
          and we will respond within the time required by law.
        </p>
        <h2>Data processing terms</h2>
        <p>
          We offer a Data Processing Addendum (DPA) that reflects the GDPR&apos;s Article 28 requirements, including
          confidentiality, security, sub-processor obligations, and assistance with data-subject requests. Contact us to
          put a DPA in place.
        </p>
        <h2>International transfers</h2>
        <p>
          Where personal data is transferred outside the EEA, we rely on appropriate safeguards such as the European
          Commission&apos;s Standard Contractual Clauses.
        </p>
        <h2>Security and breach notification</h2>
        <p>
          We maintain technical and organizational measures to protect personal data (see <a href="/legal/security">Security</a>)
          and will notify affected customers of a personal-data breach without undue delay, as required.
        </p>
        <h2>Contact</h2>
        <p>
          For GDPR requests or a DPA, email <a href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>.
        </p>
      </>
    ),
  },
  {
    slug: "security",
    title: "Security",
    description: "How Tacto protects your data — encryption, access control, redaction, and responsible disclosure.",
    updated: "2026-06-01",
    Body: () => (
      <>
        <p>
          Security is foundational to Tacto. Because guides can contain screenshots of real systems, we design the
          product and our practices to keep that data protected.
        </p>
        <h2>Encryption</h2>
        <p>
          Data is encrypted in transit with TLS and encrypted at rest. Access to production systems is limited to
          authorized personnel and protected by strong authentication.
        </p>
        <h2>Access control</h2>
        <p>
          Workspaces isolate customer data. Within a workspace, roles and permissions control who can view and edit
          guides. Business plans add SAML SSO and audit logging for centralized control.
        </p>
        <h2>Redaction</h2>
        <p>
          To help you avoid exposing sensitive information, Tacto provides manual blur on any screenshot region and
          automatic PII redaction on Business plans. You control what is captured and published.
        </p>
        <h2>Infrastructure</h2>
        <p>
          We host on reputable cloud infrastructure with physical and network security controls, regular backups, and
          monitoring. We follow the principle of least privilege across our systems.
        </p>
        <h2>Responsible disclosure</h2>
        <p>
          If you believe you&apos;ve found a security vulnerability, please report it to <a href={`mailto:${SECURITY_CONTACT}`}>{SECURITY_CONTACT}</a>.
          We investigate all legitimate reports and appreciate coordinated disclosure. Please give us a reasonable chance
          to remediate before any public disclosure.
        </p>
        <h2>Contact</h2>
        <p>
          Security questions or reports? Email <a href={`mailto:${SECURITY_CONTACT}`}>{SECURITY_CONTACT}</a>.
        </p>
      </>
    ),
  },
]

export function getLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((d) => d.slug === slug)
}
