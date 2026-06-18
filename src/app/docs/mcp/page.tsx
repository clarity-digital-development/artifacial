/**
 * Public docs page — how to install Artifacial as an MCP server in Claude
 * Desktop, Claude Code, and Cursor.
 */

export const metadata = {
  title: "Artifacial MCP — Install Guide",
  description:
    "Connect Claude Desktop, Claude Code, or any MCP client to Artifacial. Generate viral video presets, upscale images, predict virality — all from your Claude chat.",
};

const APP_URL = process.env.APP_URL ?? "https://artifacial.app";
const MCP_URL = `${APP_URL}/api/mcp`;

export default function McpDocsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-[var(--text-primary)]">
      <header className="mb-10">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-amber)]">
          Developers
        </p>
        <h1 className="font-display text-3xl font-bold">Artifacial MCP server</h1>
        <p className="mt-3 text-base leading-relaxed text-[var(--text-secondary)]">
          Plug Artifacial into Claude Desktop, Claude Code, or any{" "}
          <a
            href="https://modelcontextprotocol.io"
            className="underline underline-offset-2"
            target="_blank"
            rel="noreferrer"
          >
            Model Context Protocol
          </a>{" "}
          client. Ask Claude to predict a video&apos;s virality, upscale an image, remove a
          background, or pull your credit balance — without leaving the chat.
        </p>
      </header>

      <Section title="1. Generate an API key">
        <p>
          Go to{" "}
          <a className="underline underline-offset-2" href="/settings">
            Settings
          </a>{" "}
          → <strong>MCP API Keys</strong>. Name your key (e.g. &quot;Claude Desktop&quot;) and copy
          the value — it&apos;s shown exactly once.
        </p>
        <p className="mt-3 text-[12px] text-[var(--text-muted)]">
          Keys start with <code className="font-mono">afk_live_</code>. Each generation made
          through Claude bills your Artifacial credit balance directly.
        </p>
      </Section>

      <Section title="2a. Claude Desktop">
        <p>
          Edit the Claude Desktop config (
          <code className="font-mono">~/Library/Application Support/Claude/claude_desktop_config.json</code>{" "}
          on macOS,{" "}
          <code className="font-mono">%APPDATA%\Claude\claude_desktop_config.json</code> on
          Windows):
        </p>
        <CodeBlock>{JSON.stringify(
          {
            mcpServers: {
              artifacial: {
                type: "http",
                url: MCP_URL,
                headers: { Authorization: "Bearer afk_live_YOUR_KEY_HERE" },
              },
            },
          },
          null,
          2,
        )}</CodeBlock>
        <p className="mt-3 text-[12px] text-[var(--text-muted)]">
          Restart Claude Desktop. The MCP icon in the chat input should show Artifacial as
          connected.
        </p>
      </Section>

      <Section title="2b. Claude Code (CLI)">
        <p>Add the server with one command:</p>
        <CodeBlock>{`claude mcp add --transport http artifacial ${MCP_URL} \\\n  --header "Authorization: Bearer afk_live_YOUR_KEY_HERE"`}</CodeBlock>
        <p className="mt-3">
          Or check in a project-scoped <code className="font-mono">.mcp.json</code> alongside your
          repo:
        </p>
        <CodeBlock>{JSON.stringify(
          {
            mcpServers: {
              artifacial: {
                type: "http",
                url: MCP_URL,
                headers: { Authorization: "Bearer ${MCP_TOKEN}" },
              },
            },
          },
          null,
          2,
        )}</CodeBlock>
      </Section>

      <Section title="2c. Older clients (stdio bridge)">
        <p>
          If your client only supports the stdio transport, use{" "}
          <code className="font-mono">mcp-remote</code> as a bridge:
        </p>
        <CodeBlock>{JSON.stringify(
          {
            mcpServers: {
              artifacial: {
                command: "npx",
                args: ["mcp-remote", MCP_URL, "--header", "Authorization:Bearer afk_live_YOUR_KEY_HERE"],
              },
            },
          },
          null,
          2,
        )}</CodeBlock>
      </Section>

      <Section title="3. What Claude can do">
        <p>Currently exposed tools:</p>
        <ul className="mt-3 space-y-2 text-[14px] text-[var(--text-secondary)]">
          <ToolListItem name="get_credits" cost="free">
            Show your current credit balance (subscription + purchased).
          </ToolListItem>
          <ToolListItem name="list_workshop_tools" cost="free">
            Browse the full workshop catalog with credits cost per tool.
          </ToolListItem>
          <ToolListItem name="list_recent_generations" cost="free">
            Pull your 20 most-recent generations across the workshop and /generate.
          </ToolListItem>
          <ToolListItem name="get_generation" cost="free">
            Check the status of a single generation by ID — use to poll async jobs.
          </ToolListItem>
          <ToolListItem name="analyze_video_virality" cost="200 cr">
            Score a short-form video for viral potential. Synchronous — returns hook,
            retention, scroll-stop scores plus honest critique.
          </ToolListItem>
          <ToolListItem name="remove_image_background" cost="10 cr">
            Submit an image for background removal. Returns a generationId — poll with
            <code className="font-mono"> get_generation</code>.
          </ToolListItem>
          <ToolListItem name="upscale_image_recraft" cost="60 cr">
            Budget-tier image upscale via Recraft Crisp.
          </ToolListItem>
          <ToolListItem name="upscale_image_topaz" cost="800–3,200 cr">
            Premium image upscale (2× / 4× / 8×) via Topaz Photo AI.
          </ToolListItem>
        </ul>
      </Section>

      <Section title="4. Skill / usage guide (for AI agents)">
        <p>
          The MCP server exposes a markdown <strong>usage guide</strong> as an MCP{" "}
          <em>resource</em> at <code className="font-mono">artifacial://skill/usage-guide</code>.
          When you connect to Artifacial from Claude Desktop, Claude Code, or any other MCP
          client, the agent can fetch this guide via the standard{" "}
          <code className="font-mono">resources/list</code> +{" "}
          <code className="font-mono">resources/read</code> methods. It covers every tool,
          async-vs-sync polling cadence, credit costs, common workflows, and where to redirect
          users when their request needs the web UI.
        </p>
        <p className="mt-3">
          The same content is also available as plain markdown at{" "}
          <a
            className="font-mono underline underline-offset-2"
            href="/docs/mcp/skill"
            target="_blank"
            rel="noreferrer"
          >
            /docs/mcp/skill
          </a>{" "}
          — paste it as system context into any LLM, share it with your team, or download it
          for offline reference.
        </p>
        <p className="mt-3 text-[12px] text-[var(--text-muted)]">
          Tip: in Claude Code, you can attach the skill to your turn with{" "}
          <code className="font-mono">@artifacial:artifacial://skill/usage-guide</code>.
        </p>
      </Section>

      <Section title="5. Troubleshooting">
        <ul className="space-y-3 text-[14px] text-[var(--text-secondary)]">
          <li>
            <strong>&quot;Invalid or revoked API key&quot;</strong> — Generate a new key in{" "}
            <a className="underline underline-offset-2" href="/settings">Settings</a>; revoke the
            old one if compromised.
          </li>
          <li>
            <strong>&quot;Insufficient credits&quot;</strong> — Top up at{" "}
            <a className="underline underline-offset-2" href="/settings">Settings → Billing</a>.
          </li>
          <li>
            <strong>Server endpoint:</strong>{" "}
            <code className="font-mono">{MCP_URL}</code> (POST only, Bearer auth required).
          </li>
          <li>
            <strong>Protocol version:</strong> 2025-06-18 (with 2025-03-26 backwards compat).
          </li>
        </ul>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
      <div className="text-[14px] leading-relaxed text-[var(--text-secondary)]">{children}</div>
    </section>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-black/40 p-4 font-mono text-[12px] leading-relaxed text-[var(--text-primary)]">
      {children}
    </pre>
  );
}

function ToolListItem({ name, cost, children }: { name: string; cost: string; children: React.ReactNode }) {
  return (
    <li>
      <code className="font-mono text-[var(--accent-amber)]">{name}</code>{" "}
      <span className="text-[11px] text-[var(--text-muted)]">— {cost}</span>
      <p className="mt-0.5 text-[var(--text-secondary)]">{children}</p>
    </li>
  );
}
