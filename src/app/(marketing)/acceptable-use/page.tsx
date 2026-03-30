import Link from "next/link";

export const metadata = { title: "Acceptable Use Policy — Artifacial" };

export default function AcceptableUsePage() {
  return (
    <div className="min-h-screen bg-[var(--bg-deep)] px-5 py-16 md:px-16">
      <div className="mx-auto max-w-3xl">
        {/* Back */}
        <Link href="/" className="mb-10 inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          Back
        </Link>

        <h1 className="font-display text-4xl font-bold text-[var(--text-primary)]">Acceptable Use Policy</h1>
        <div className="mt-2 text-sm text-[var(--text-muted)]">
          <span className="font-medium text-[var(--accent-amber)]">Artifacial.app</span>
          <span className="mx-2">·</span>
          Effective Date: March 28, 2026
          <span className="mx-2">·</span>
          Last Updated: March 28, 2026
        </div>

        <div className="mt-12 space-y-10">

          <Section id="1" title="1. Purpose">
            <p>This Acceptable Use Policy ("AUP") governs what content may and may not be generated using Artifacial.app ("the Service"). This policy exists to protect users, third parties, and the public from harmful misuse of AI-generated media. It supplements our <Link href="/terms" className="text-[var(--accent-amber)] hover:underline">Terms of Service</Link> and is enforceable under those Terms.</p>
          </Section>

          <Section id="2" title="2. General Principles">
            <p>Artifacial.app provides AI-powered photo and video generation, including NSFW content for adult users. We believe in creative freedom within clearly defined boundaries. The line we draw is simple: your content cannot harm real people, exploit minors, or break the law.</p>
          </Section>

          <Section id="3" title="3. Permitted Content">
            <p>The following types of content are permitted on the Service:</p>
            <ul>
              <li><strong className="text-[var(--text-primary)]">General creative content:</strong> Artwork, illustrations, concept art, stock imagery, marketing materials, and other non-explicit creative outputs.</li>
              <li><strong className="text-[var(--text-primary)]">NSFW content:</strong> Sexually explicit or adult-oriented imagery and video involving fictional, non-identifiable subjects. This content is restricted to users who have confirmed they are 18 or older.</li>
              <li><strong className="text-[var(--text-primary)]">Fantasy and fictional scenarios:</strong> Content depicting fictional characters, imaginary settings, and creative scenarios that do not depict identifiable real individuals.</li>
            </ul>
          </Section>

          <Section id="4" title="4. Prohibited Content">
            <p>The following content is strictly prohibited. Attempts to generate this content — whether successful or not — constitute a violation of this policy.</p>

            <Subsection title="4.1 Deepfakes and Non-Consensual Depictions">
              <ul>
                <li>Realistic synthetic media depicting identifiable real individuals without their explicit, verifiable consent.</li>
                <li>Any content that places the likeness of a real person in a fabricated scenario, whether sexual or non-sexual, without documented consent.</li>
                <li>Content designed to impersonate a real individual for deceptive purposes.</li>
              </ul>
            </Subsection>

            <Subsection title="4.2 Child Sexual Abuse Material (CSAM)">
              <ul>
                <li>Any sexual or suggestive content depicting minors, whether realistic or stylized.</li>
                <li>Any content that sexualizes minors in any form, including cartoon, anime, or other illustrated styles.</li>
                <li>Any content that sexualizes minors in any form, including cartoon, anime, or other illustrated styles.</li>
              </ul>
              <div className="mt-3 rounded-[var(--radius-md)] border border-red-500/30 bg-red-500/10 p-4">
                <p className="text-sm font-semibold text-red-400">Zero-tolerance policy.</p>
                <p className="mt-1 text-sm text-red-400/80">Violations result in immediate account termination and mandatory reporting to the National Center for Missing &amp; Exploited Children (NCMEC) and applicable law enforcement. No exceptions.</p>
              </div>
            </Subsection>

            <Subsection title="4.3 Non-Consensual Sexual Content">
              <ul>
                <li>Sexual content depicting identifiable real individuals without their verified consent.</li>
                <li>"Revenge porn" or intimate imagery of real individuals created or distributed without consent.</li>
              </ul>
            </Subsection>

            <Subsection title="4.4 Violence, Terrorism, and Extremism">
              <ul>
                <li>Content that promotes, incites, or glorifies real-world violence against specific individuals or groups.</li>
                <li>Terrorist propaganda, recruitment materials, or instructional content for carrying out attacks.</li>
                <li>Content promoting genocide, ethnic cleansing, or targeted violence based on protected characteristics.</li>
              </ul>
            </Subsection>

            <Subsection title="4.5 Fraud and Deception">
              <ul>
                <li>Content created for the purpose of fraud, impersonation, phishing, or scamming.</li>
                <li>Fake evidence, fabricated news, or synthetic media intended to deceive the public or manipulate elections.</li>
                <li>Forged documents, credentials, or identification materials.</li>
              </ul>
            </Subsection>

            <Subsection title="4.6 Other Prohibited Uses">
              <ul>
                <li>Content that violates any applicable federal, state, or local law.</li>
                <li>Content that infringes the intellectual property rights of third parties.</li>
                <li>Automated or bulk generation designed to circumvent safety systems or generate prohibited content at scale.</li>
              </ul>
            </Subsection>
          </Section>

          <Section id="5" title="5. Prompt Restrictions">
            <p>The prohibitions in this policy apply to your prompts as well as generated outputs. Submitting prompts designed to produce prohibited content — even if the generation is blocked by our safety systems — is itself a violation.</p>
            <p>Attempting to circumvent content filters through prompt engineering, obfuscation, encoding, or any other technique is a serious violation and will be treated accordingly.</p>
          </Section>

          <Section id="6" title="6. Monitoring and Enforcement">
            <Subsection title="6.1 Logging">
              <p>All prompts and generated content are logged and associated with your account. This logging is a core component of our safety infrastructure and is not optional.</p>
            </Subsection>
            <Subsection title="6.2 Automated Detection">
              <p>We employ automated systems to detect prohibited content and policy-violating prompts. These systems may flag content for manual review.</p>
            </Subsection>
            <Subsection title="6.3 Manual Review">
              <p>Our team may manually review flagged prompts and generated content. By using the Service, you acknowledge and consent to this review.</p>
            </Subsection>
            <Subsection title="6.4 Enforcement Actions">
              <p>Violations of this policy may result in one or more of the following:</p>
              <ul>
                <li>Warning and content removal</li>
                <li>Temporary suspension of your account</li>
                <li>Permanent termination of your account</li>
                <li>Forfeiture of remaining subscription credits without refund</li>
                <li>Reporting to law enforcement or other appropriate authorities</li>
              </ul>
              <p>The severity of enforcement depends on the nature, intent, and frequency of the violation. Certain violations — particularly those involving CSAM — result in immediate termination and law enforcement reporting with no prior warning.</p>
            </Subsection>
          </Section>

          <Section id="7" title="7. Law Enforcement Cooperation">
            <p>We cooperate fully with law enforcement investigations. When we detect violations that constitute or suggest criminal activity, or when we receive valid legal process, we will provide logged prompts, generated content, account information, and associated metadata to the requesting authorities.</p>
            <p>We may also make proactive, voluntary disclosures to law enforcement or organizations such as NCMEC when we discover evidence of serious criminal conduct.</p>
          </Section>

          <Section id="8" title="8. Reporting Violations">
            <p>If you become aware of content generated through the Service that violates this policy, please report it to <a href="mailto:tanner@claritydigital.dev" className="text-[var(--accent-amber)] hover:underline">tanner@claritydigital.dev</a>. We take all reports seriously and will investigate promptly.</p>
          </Section>

          <Section id="9" title="9. FCC Compliance">
            <p>The Service is operated in compliance with applicable FCC guidelines on AI-generated media. Users are independently responsible for ensuring that their downstream use of generated content — including distribution, broadcast, and publication — complies with all applicable FCC regulations, including disclosure and labeling requirements.</p>
          </Section>

          <Section id="10" title="10. Changes to This Policy">
            <p>We may update this AUP from time to time to reflect changes in law, technology, or our practices. Material changes will be communicated via the email associated with your account. Continued use of the Service after changes constitutes acceptance.</p>
          </Section>

          <Section id="11" title="11. Contact">
            <p>For questions about this policy, or to report a violation, contact us at: <a href="mailto:tanner@claritydigital.dev" className="text-[var(--accent-amber)] hover:underline">tanner@claritydigital.dev</a></p>
          </Section>

        </div>

        {/* Footer nav */}
        <div className="mt-16 flex flex-wrap gap-4 border-t border-[var(--border-subtle)] pt-8 text-xs text-[var(--text-muted)]">
          <Link href="/terms" className="hover:text-[var(--text-secondary)]">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-[var(--text-secondary)]">Privacy Policy</Link>
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
