import Link from "next/link";

export const metadata = { title: "Terms of Service — Artifacial" };

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-deep)] px-5 py-16 md:px-16">
      <div className="mx-auto max-w-3xl">
        {/* Back */}
        <Link href="/" className="mb-10 inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          Back
        </Link>

        <h1 className="font-display text-4xl font-bold text-[var(--text-primary)]">Terms of Service</h1>
        <div className="mt-2 text-sm text-[var(--text-muted)]">
          <span className="font-medium text-[var(--accent-amber)]">Artifacial.app</span>
          <span className="mx-2">·</span>
          Effective Date: March 28, 2026
          <span className="mx-2">·</span>
          Last Updated: March 28, 2026
        </div>

        <div className="prose-legal mt-12 space-y-10">

          <Section id="1" title="1. Agreement to Terms">
            <p>By accessing or using Artifacial.app ("the Service," "we," "us," or "our"), you ("User," "you," or "your") agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the Service.</p>
            <p>We reserve the right to modify these Terms at any time. Continued use of the Service after changes constitutes acceptance of the revised Terms. We will notify users of material changes via the email associated with your account.</p>
          </Section>

          <Section id="2" title="2. Description of Service">
            <p>Artifacial.app is a web-based platform that enables users to generate video and photo content using artificial intelligence models. The Service includes both general-purpose and NSFW (Not Safe for Work) content generation capabilities, subject to the restrictions outlined in these Terms and our Acceptable Use Policy.</p>
          </Section>

          <Section id="3" title="3. Eligibility and Account Registration">
            <Subsection title="3.1 Age Requirement">
              <p>You must be at least 18 years of age to use the Service. By creating an account, you affirm that you are at least 18 years old. We reserve the right to terminate any account where we have reason to believe the user is under 18.</p>
            </Subsection>
            <Subsection title="3.2 Account Creation">
              <p>Accounts are created through third-party single sign-on (SSO) authentication providers. You are responsible for maintaining the security of your authentication credentials. You are liable for all activity conducted through your account.</p>
            </Subsection>
            <Subsection title="3.3 One Account Per User">
              <p>Each individual may maintain only one account. Creating multiple accounts to circumvent restrictions, bans, or usage limits is grounds for immediate termination.</p>
            </Subsection>
          </Section>

          <Section id="4" title="4. Subscriptions and Payment">
            <Subsection title="4.1 Subscription Plans">
              <p>The Service operates on a subscription basis that provides a monthly allocation of generation credits. Details of available plans, pricing, and credit allotments are described on our pricing page and may change from time to time.</p>
            </Subsection>
            <Subsection title="4.2 Billing">
              <p>Payments are processed through Stripe. By subscribing, you authorize recurring charges to your selected payment method. All fees are quoted in U.S. dollars unless stated otherwise.</p>
            </Subsection>
            <Subsection title="4.3 Refunds">
              <p>All subscription fees are non-refundable except where required by applicable law. Unused credits do not roll over between billing periods unless your plan explicitly states otherwise.</p>
            </Subsection>
            <Subsection title="4.4 Cancellation">
              <p>You may cancel your subscription at any time through your account settings. Cancellation takes effect at the end of the current billing period. You will retain access to the Service until that period concludes.</p>
            </Subsection>
          </Section>

          <Section id="5" title="5. User Content and Intellectual Property">
            <Subsection title="5.1 Your Prompts">
              <p>You retain ownership of the text prompts you submit to the Service. By submitting prompts, you grant us a limited, non-exclusive license to process them for the purpose of generating content, enforcing our policies, and complying with legal obligations.</p>
            </Subsection>
            <Subsection title="5.2 Generated Content">
              <p>Subject to these Terms and applicable law, you are granted a non-exclusive, worldwide license to use content generated through the Service for personal or commercial purposes. We do not claim ownership of content generated through your use of the Service, but we retain the right to use generated content for safety review, policy enforcement, model improvement, and legal compliance.</p>
            </Subsection>
            <Subsection title="5.3 Restrictions on Generated Content">
              <p>You may not represent AI-generated content as human-created in contexts where such representation would be deceptive, illegal, or in violation of applicable FCC guidelines. You are solely responsible for ensuring your use of generated content complies with all applicable laws and regulations.</p>
            </Subsection>
          </Section>

          <Section id="6" title="6. Prohibited Conduct">
            <p>You agree not to use the Service to:</p>
            <ul>
              <li>Generate deepfake content — defined as realistic synthetic media depicting real, identifiable individuals without their explicit, documented consent.</li>
              <li>Generate child sexual abuse material (CSAM) or any sexual content depicting minors.</li>
              <li>Generate content depicting real individuals in sexual or compromising scenarios without their verified, documented consent.</li>
              <li>Circumvent, disable, or attempt to bypass any safety filters, content moderation systems, or technical restrictions.</li>
              <li>Use the Service for harassment, defamation, fraud, or any unlawful purpose.</li>
              <li>Resell, redistribute, or sublicense access to the Service or its outputs without written authorization.</li>
              <li>Reverse engineer, decompile, or attempt to extract source code or model weights from the Service.</li>
              <li>Automate access to the Service (bots, scrapers, etc.) without prior written permission.</li>
            </ul>
            <p>Violations of this section may result in immediate account termination and referral to law enforcement where appropriate. See our <Link href="/acceptable-use" className="text-[var(--accent-amber)] hover:underline">Acceptable Use Policy</Link> for additional detail.</p>
          </Section>

          <Section id="7" title="7. Monitoring, Logging, and Law Enforcement Cooperation">
            <Subsection title="7.1 Logging">
              <p>We log user prompts and generated content. This logging is necessary to enforce our policies, prevent abuse, comply with applicable law, and cooperate with law enforcement investigations.</p>
            </Subsection>
            <Subsection title="7.2 Review">
              <p>We may review logged prompts and generated content — manually or through automated systems — to detect violations of these Terms, our Acceptable Use Policy, or applicable law.</p>
            </Subsection>
            <Subsection title="7.3 Law Enforcement Disclosure">
              <p>We will disclose logged data, including prompts and generated content, to law enforcement agencies when required by valid legal process (subpoena, court order, or warrant) or when we have a good-faith belief that disclosure is necessary to prevent imminent harm or illegal activity. We may also make voluntary disclosures to the National Center for Missing & Exploited Children (NCMEC) or other appropriate authorities if we discover CSAM or evidence of other serious criminal conduct.</p>
            </Subsection>
          </Section>

          <Section id="8" title="8. FCC Compliance">
            <p>The Service is designed and operated in compliance with applicable Federal Communications Commission (FCC) guidelines regarding AI-generated video and photo content. Users are independently responsible for ensuring that their use of generated content complies with all applicable FCC regulations, including but not limited to requirements around disclosure and labeling of AI-generated media.</p>
          </Section>

          <Section id="9" title="9. NSFW Content">
            <Subsection title="9.1 Availability">
              <p>The Service permits the generation of NSFW content, including sexually explicit material, subject to the restrictions in Section 6 and our Acceptable Use Policy. NSFW content features are only available to users who have confirmed they are 18 or older.</p>
            </Subsection>
            <Subsection title="9.2 User Responsibility">
              <p>You are solely responsible for your use and distribution of NSFW content generated through the Service. You agree not to distribute such content in any manner that violates applicable obscenity, decency, or distribution laws.</p>
            </Subsection>
          </Section>

          <Section id="10" title="10. Disclaimers">
            <p className="uppercase tracking-wide text-[var(--text-secondary)] text-sm leading-relaxed">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE." WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
            </p>
            <p>We do not guarantee the accuracy, quality, or legality of any AI-generated content. You use the Service and its outputs at your own risk.</p>
          </Section>

          <Section id="11" title="11. Limitation of Liability">
            <p className="uppercase tracking-wide text-[var(--text-secondary)] text-sm leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, ARTIFACIAL.APP AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICE, REGARDLESS OF THE THEORY OF LIABILITY.
            </p>
            <p className="uppercase tracking-wide text-[var(--text-secondary)] text-sm leading-relaxed">
              OUR TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS ARISING FROM OR RELATED TO THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
            </p>
          </Section>

          <Section id="12" title="12. Indemnification">
            <p>You agree to indemnify, defend, and hold harmless Artifacial.app and its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including reasonable attorneys' fees) arising from your use of the Service, your violation of these Terms, or your violation of any third-party rights.</p>
          </Section>

          <Section id="13" title="13. Termination">
            <p>We may suspend or terminate your account at any time, with or without cause, and with or without notice. Upon termination, your right to use the Service ceases immediately. Provisions that by their nature should survive termination — including Sections 5, 7, 10, 11, 12, and 14 — shall survive.</p>
          </Section>

          <Section id="14" title="14. Governing Law and Dispute Resolution">
            <p>These Terms are governed by the laws of the State of Delaware, without regard to conflict of law principles. Any disputes arising from these Terms or the Service shall be resolved exclusively in the state or federal courts located in Delaware. You consent to personal jurisdiction in such courts.</p>
          </Section>

          <Section id="15" title="15. Severability">
            <p>If any provision of these Terms is found to be unenforceable, that provision will be modified to the minimum extent necessary to make it enforceable, and the remaining provisions will continue in full force and effect.</p>
          </Section>

          <Section id="16" title="16. Entire Agreement">
            <p>These Terms, together with our <Link href="/privacy" className="text-[var(--accent-amber)] hover:underline">Privacy Policy</Link> and <Link href="/acceptable-use" className="text-[var(--accent-amber)] hover:underline">Acceptable Use Policy</Link>, constitute the entire agreement between you and Artifacial.app regarding the Service.</p>
          </Section>

          <Section id="17" title="17. Contact">
            <p>For questions about these Terms, contact us at: <a href="mailto:tanner@claritydigital.dev" className="text-[var(--accent-amber)] hover:underline">tanner@claritydigital.dev</a></p>
          </Section>

        </div>

        {/* Footer nav */}
        <div className="mt-16 flex flex-wrap gap-4 border-t border-[var(--border-subtle)] pt-8 text-xs text-[var(--text-muted)]">
          <Link href="/privacy" className="hover:text-[var(--text-secondary)]">Privacy Policy</Link>
          <Link href="/acceptable-use" className="hover:text-[var(--text-secondary)]">Acceptable Use Policy</Link>
          <Link href="/" className="ml-auto hover:text-[var(--text-secondary)]">← Back to Artifacial</Link>
        </div>
      </div>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={`section-${id}`} className="scroll-mt-8">
      <h2 className="mb-4 font-display text-xl font-bold text-[var(--text-primary)]">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-[var(--text-secondary)]">{children}</div>
    </section>
  );
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
