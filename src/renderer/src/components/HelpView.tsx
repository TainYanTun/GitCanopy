import React from "react";

export const HelpView: React.FC = () => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? 'Cmd' : 'Ctrl';

  return (
    <div className="h-full overflow-y-auto bg-zed-bg dark:bg-zed-dark-bg selection:bg-zed-accent/30 animate-in fade-in duration-500">
      <div className="max-w-2xl mx-auto px-8 py-20 space-y-24 text-zed-text dark:text-zed-dark-text font-sans antialiased">
        {/* Abstract */}
        <section className="space-y-4">
          <h1 className="text-sm font-bold uppercase tracking-[0.2em] text-zed-accent dark:text-zed-dark-accent font-mono">
            GitCanopy / Reference
          </h1>
          <p className="text-lg leading-relaxed text-zed-text dark:text-zed-dark-text font-medium">
            GitCanopy is a non-linear version control visualizer. It maps the
            Directed Acyclic Graph (DAG) of a Git repository onto a stable,
            multi-lane grid system optimized for architectural clarity.
          </p>
        </section>

        {/* 01. The Visualization Engine */}
        <section className="space-y-8">
          <div className="flex items-baseline gap-4">
            <span className="text-xs font-mono text-zed-accent/50 dark:text-zed-dark-accent/50 font-bold">
              01
            </span>
            <h2 className="text-lg font-bold tracking-tight text-zed-text dark:text-zed-dark-text border-b border-zed-border dark:border-zed-dark-border pb-2 flex-grow">
              The Visualization Engine
            </h2>
          </div>

          <div className="space-y-12 pl-8">
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-zed-text dark:text-zed-dark-text uppercase tracking-tight">
                Railway Algorithm
              </h3>
              <p className="text-sm text-zed-muted dark:text-zed-dark-muted leading-relaxed">
                The engine uses a lane-persistent layout. It optimizes for
                structural continuity, assigning branches to stable lanes that
                persist until a merge or deletion occurs. This multi-lane system
                minimizes crossing lines and prevents visual jitter during
                scrolling.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-zed-accent dark:text-zed-dark-accent">
                Symbolic Encoding
              </h3>
              <div className="grid grid-cols-1 gap-6 text-sm">
                <div className="flex gap-6">
                  <div className="w-1/3 shrink-0 text-zed-muted dark:text-zed-dark-muted font-bold uppercase text-[10px] pt-1">
                    Commit Tag Color
                  </div>
                  <div className="space-y-2">
                    <p className="text-zed-text dark:text-zed-dark-text">
                      Colors indicate the semantic intent of a commit based on
                      the{" "}
                      <span className="text-zed-accent dark:text-zed-dark-accent font-bold">
                        Conventional Commits
                      </span>{" "}
                      specification.
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-commit-feat shadow-[0_0_10px_rgba(152,195,121,0.4)]"></span>{" "}
                        <span className="text-xs font-mono font-bold text-commit-feat">
                          feat
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-commit-fix shadow-[0_0_10px_rgba(224,108,117,0.4)]"></span>{" "}
                        <span className="text-xs font-mono font-bold text-commit-fix">
                          fix
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-commit-refactor shadow-[0_0_10px_rgba(229,192,123,0.4)]"></span>{" "}
                        <span className="text-xs font-mono font-bold text-commit-refactor">
                          refac
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-commit-docs shadow-[0_0_10px_rgba(97,175,239,0.4)]"></span>{" "}
                        <span className="text-xs font-mono font-bold text-commit-docs">
                          docs
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-6 border-t border-zed-border dark:border-zed-dark-border pt-6">
                  <div className="w-1/3 shrink-0 text-zed-muted dark:text-zed-dark-muted font-bold uppercase text-[10px] pt-1">
                    Node Geometry
                  </div>
                  <div className="space-y-2">
                    <p className="text-zed-text dark:text-zed-dark-text">
                      Shapes represent structural events in the history.
                    </p>
                    <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <span className="text-zed-muted dark:text-zed-dark-muted text-lg">
                          ○
                        </span>{" "}
                        <span className="font-bold">Standard</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-zed-accent dark:text-zed-dark-accent text-lg font-bold">
                          ◆
                        </span>{" "}
                        <span className="font-bold">Merge</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-commit-fix text-lg font-bold">
                          □
                        </span>{" "}
                        <span className="font-bold">Revert</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 02. Conventional Metadata */}
        <section className="space-y-8">
          <div className="flex items-baseline gap-4">
            <span className="text-xs font-mono text-zed-accent/50 dark:text-zed-dark-accent/50 font-bold">
              02
            </span>
            <h2 className="text-lg font-bold tracking-tight text-zed-text dark:text-zed-dark-text border-b border-zed-border dark:border-zed-dark-border pb-2 flex-grow">
              Conventional Metadata
            </h2>
          </div>

          <div className="space-y-8 pl-8">
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-zed-text dark:text-zed-dark-text uppercase">
                Semantic Commit Messages
              </h3>
              <p className="text-sm text-zed-muted dark:text-zed-dark-muted leading-relaxed">
                GitCanopy automatically parses your commit subjects. Using
                prefixes like{" "}
                <code className="text-zed-accent dark:text-zed-dark-accent font-mono font-bold bg-zed-element dark:bg-zed-dark-element px-1.5 py-0.5 rounded">
                  feat:
                </code>{" "}
                or{" "}
                <code className="text-zed-accent dark:text-zed-dark-accent font-mono font-bold bg-zed-element dark:bg-zed-dark-element px-1.5 py-0.5 rounded">
                  fix:
                </code>{" "}
                allows the engine to instantly categorize work.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-bold text-zed-text dark:text-zed-dark-text uppercase">
                Branch Naming Patterns
              </h3>
              <p className="text-sm text-zed-muted dark:text-zed-dark-muted leading-relaxed">
                Visual identity is mapped to common industry naming patterns:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono mt-4">
                <div className="p-4 bg-zed-element/50 dark:bg-zed-dark-element/50 rounded-lg border border-zed-border dark:border-zed-dark-border shadow-sm">
                  <span className="text-zed-accent dark:text-zed-dark-accent font-bold">
                    feature/*
                  </span>
                  <p className="text-zed-muted dark:text-zed-dark-muted mt-1 font-sans italic text-[10px]">
                    Unique feature-lane colors.
                  </p>
                </div>
                <div className="p-4 bg-zed-element/50 dark:bg-zed-dark-element/50 rounded-lg border border-zed-border dark:border-zed-dark-border shadow-sm">
                  <span className="text-zed-accent dark:text-zed-dark-accent font-bold">
                    hotfix/*
                  </span>
                  <p className="text-zed-muted dark:text-zed-dark-muted mt-1 font-sans italic text-[10px]">
                    Locked to high-priority Orange.
                  </p>
                </div>
                <div className="p-4 bg-zed-element/50 dark:bg-zed-dark-element/50 rounded-lg border border-zed-border dark:border-zed-dark-border shadow-sm">
                  <span className="text-zed-accent dark:text-zed-dark-accent font-bold">
                    release/*
                  </span>
                  <p className="text-zed-muted dark:text-zed-dark-muted mt-1 font-sans italic text-[10px]">
                    Locked to stable Red.
                  </p>
                </div>
                <div className="p-4 bg-zed-element/50 dark:bg-zed-dark-element/50 rounded-lg border border-zed-border dark:border-zed-dark-border shadow-sm">
                  <span className="text-zed-accent dark:text-zed-dark-accent font-bold">
                    develop
                  </span>
                  <p className="text-zed-muted dark:text-zed-dark-muted mt-1 font-sans italic text-[10px]">
                    Locked to Emerald Green.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 03. Interaction Logic */}
        <section className="space-y-8">
          <div className="flex items-baseline gap-4">
            <span className="text-xs font-mono text-zed-accent/50 dark:text-zed-dark-accent/50 font-bold">
              03
            </span>
            <h2 className="text-lg font-bold tracking-tight text-zed-text dark:text-zed-dark-text border-b border-zed-border dark:border-zed-dark-border pb-2 flex-grow">
              Interaction Logic
            </h2>
          </div>

          <div className="space-y-8 pl-8 text-sm">
            <div className="space-y-3">
              <h3 className="font-bold text-zed-text dark:text-zed-dark-text">
                Linear Focus Mode
              </h3>
              <p className="text-zed-muted dark:text-zed-dark-muted leading-relaxed">
                Hovering over any node triggers a recursive lineage trace.{" "}
                <span className="text-zed-text dark:text-zed-dark-text font-semibold underline decoration-zed-accent/30">
                  Ancestors
                </span>{" "}
                and{" "}
                <span className="text-zed-text dark:text-zed-dark-text font-semibold underline decoration-zed-accent/30">
                  Descendants
                </span>{" "}
                are highlighted, while unrelated branches are dimmed. This
                isolates the &quot;story&quot; of a feature from the noise of
                the rest of the repository.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-bold text-zed-text dark:text-zed-dark-text">
                Selection & Diffs
              </h3>
              <p className="text-zed-muted dark:text-zed-dark-muted leading-relaxed">
                Selecting a commit activates the Detail Panel. Files are
                presented in a hierarchical tree. Clicking a file triggers an
                asynchronous Git diff process, retrieving only the changes
                relevant to that specific delta for optimal performance.
              </p>
            </div>
          </div>
        </section>

        {/* 04. Commit Metadata Context */}
        <section className="space-y-8">
          <div className="flex items-baseline gap-4">
            <span className="text-xs font-mono text-zed-accent/50 dark:text-zed-dark-accent/50 font-bold">
              04
            </span>
            <h2 className="text-lg font-bold tracking-tight text-zed-text dark:text-zed-dark-text border-b border-zed-border dark:border-zed-dark-border pb-2 flex-grow">
              Commit Metadata Context
            </h2>
          </div>

          <div className="space-y-8 pl-8">
            <p className="text-sm text-zed-muted dark:text-zed-dark-muted leading-relaxed font-medium">
              When a commit is selected, the sidebar displays all branches that
              contain that specific work using a hierarchical highlighting
              system:
            </p>

            <div className="grid grid-cols-1 gap-6 text-xs">
              <div className="flex gap-6 items-center">
                <div className="w-28 shrink-0 px-2 py-1 rounded-full border border-zed-accent dark:border-zed-dark-accent bg-zed-accent/10 dark:bg-zed-dark-accent/20 text-zed-accent dark:text-zed-dark-accent font-bold text-center uppercase tracking-tighter">
                  ● branch
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-zed-text dark:text-zed-dark-text">
                    Branch Tip
                  </p>
                  <p className="text-zed-muted dark:text-zed-dark-muted text-[11px]">
                    The commit is the current latest endpoint (HEAD) of this
                    branch.
                  </p>
                </div>
              </div>

              <div className="flex gap-6 items-center">
                <div className="w-28 shrink-0 px-2 py-1 rounded-full border border-zed-border dark:border-zed-dark-border bg-zed-element dark:bg-zed-dark-element text-zed-text dark:text-zed-dark-text font-bold text-center uppercase tracking-tighter shadow-sm">
                  branch
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-zed-text dark:text-zed-dark-text">
                    Inferred Original
                  </p>
                  <p className="text-zed-muted dark:text-zed-dark-muted text-[11px]">
                    The primary branch context where this commit was authored.
                  </p>
                </div>
              </div>

              <div className="flex gap-6 items-center">
                <div className="w-28 shrink-0 px-2 py-1 rounded-full bg-zed-element/40 dark:bg-zed-dark-element/40 text-zed-muted dark:text-zed-dark-muted/60 text-center uppercase tracking-tighter border border-transparent">
                  branch
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-zed-text dark:text-zed-dark-text">
                    Merged / Contains
                  </p>
                  <p className="text-zed-muted dark:text-zed-dark-muted text-[11px]">
                    Branches that have incorporated this commit via merges.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 05. Global Shortcuts */}
        <section className="space-y-8">
          <div className="flex items-baseline gap-4">
            <span className="text-xs font-mono text-zed-accent/50 dark:text-zed-dark-accent/50 font-bold">
              05
            </span>
            <h2 className="text-lg font-bold tracking-tight text-zed-text dark:text-zed-dark-text border-b border-zed-border dark:border-zed-dark-border pb-2 flex-grow">
              Global Shortcuts
            </h2>
          </div>

          <div className="pl-8 space-y-6">
            <div className="grid grid-cols-2 gap-y-4 max-w-sm text-[11px] font-mono uppercase tracking-tighter bg-zed-element/20 dark:bg-zed-dark-element/20 p-6 rounded-xl border border-zed-border dark:border-zed-dark-border shadow-inner">
              <div className="text-zed-muted dark:text-zed-dark-muted font-bold">
                Sync Data
              </div>{" "}
              <div className="text-right font-bold text-zed-text dark:text-zed-dark-text">
                {modKey} R
              </div>
              <div className="text-zed-muted dark:text-zed-dark-muted font-bold">
                Open Repo
              </div>{" "}
              <div className="text-right font-bold text-zed-text dark:text-zed-dark-text">
                {modKey} O
              </div>
              <div className="text-zed-muted dark:text-zed-dark-muted font-bold">
                Switch Branch
              </div>{" "}
              <div className="text-right font-bold text-zed-text dark:text-zed-dark-text">
                {modKey} B
              </div>
              <div className="text-zed-muted dark:text-zed-dark-muted font-bold">
                AI Command
              </div>{" "}
              <div className="text-right font-bold text-zed-text dark:text-zed-dark-text">
                {modKey} J
              </div>
              <div className="text-zed-muted dark:text-zed-dark-muted font-bold">
                Select Mode
              </div>{" "}
              <div className="text-right font-bold text-zed-text dark:text-zed-dark-text">
                V
              </div>
              <div className="text-zed-muted dark:text-zed-dark-muted font-bold">
                Pan Mode
              </div>{" "}
              <div className="text-right font-bold text-zed-text dark:text-zed-dark-text">
                H
              </div>
              <div className="text-zed-muted dark:text-zed-dark-muted font-bold">
                Copy Hashes
              </div>{" "}
              <div className="text-right font-bold text-zed-text dark:text-zed-dark-text">
                {modKey} C
              </div>
              <div className="text-zed-muted dark:text-zed-dark-muted font-bold">
                Escape View
              </div>{" "}
              <div className="text-right font-bold text-zed-text dark:text-zed-dark-text">
                Esc
              </div>

              <div className="text-zed-muted dark:text-zed-dark-muted/50 border-t border-zed-border dark:border-zed-dark-border/50 pt-4">
                Search Tags
              </div>{" "}
              <div className="text-right border-t border-zed-border dark:border-zed-dark-border/50 pt-4 font-bold text-zed-accent dark:text-zed-dark-accent tracking-normal">
                tag:[name]
              </div>
              <div className="text-zed-muted dark:text-zed-dark-muted/50">
                Search Author
              </div>{" "}
              <div className="text-right font-bold text-zed-accent dark:text-zed-dark-accent tracking-normal">
                author:[name]
              </div>
              <div className="text-zed-muted dark:text-zed-dark-muted/50">
                Jump Hash
              </div>{" "}
              <div className="text-right font-bold text-zed-accent dark:text-zed-dark-accent tracking-normal">
                # [hash]
              </div>
            </div>
          </div>
        </section>

        {/* 06. State Synchronization */}
        <section className="space-y-8">
          <div className="flex items-baseline gap-4">
            <span className="text-xs font-mono text-zed-accent/50 dark:text-zed-dark-accent/50 font-bold">
              06
            </span>
            <h2 className="text-lg font-bold tracking-tight text-zed-text dark:text-zed-dark-text border-b border-zed-border dark:border-zed-dark-border pb-2 flex-grow">
              State Synchronization
            </h2>
          </div>

          <div className="space-y-4 pl-8">
            <p className="text-sm text-zed-muted dark:text-zed-dark-muted leading-relaxed">
              GitCanopy utilizes a recursive file-watcher targeting the{" "}
              <code className="text-zed-accent dark:text-zed-dark-accent font-mono font-bold bg-zed-element dark:bg-zed-dark-element px-1.5 rounded">
                .git
              </code>{" "}
              directory for event-driven UI refreshes.
            </p>
            <div className="flex items-center gap-2.5 text-[10px] font-mono font-bold text-zed-accent dark:text-zed-dark-accent uppercase tracking-[0.2em] bg-zed-accent/5 dark:bg-zed-dark-accent/10 w-fit px-3 py-1.5 rounded-full border border-zed-accent/20">
              <span className="w-2 h-2 bg-zed-accent dark:bg-zed-dark-accent rounded-full animate-pulse shadow-[0_0_10px_rgba(97,175,239,0.6)]"></span>
              Core Pipeline Active
            </div>
          </div>
        </section>

        {/* 07. GitHub Integration */}
        <section className="space-y-8">
          <div className="flex items-baseline gap-4">
            <span className="text-xs font-mono text-zed-accent/50 dark:text-zed-dark-accent/50 font-bold">
              07
            </span>
            <h2 className="text-lg font-bold tracking-tight text-zed-text dark:text-zed-dark-text border-b border-zed-border dark:border-zed-dark-border pb-2 flex-grow">
              GitHub Integration
            </h2>
          </div>

          <div className="space-y-8 pl-8">
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-zed-text dark:text-zed-dark-text uppercase">
                Actions Status Watcher
              </h3>
              <p className="text-sm text-zed-muted dark:text-zed-dark-muted leading-relaxed">
                Connect your GitHub account to monitor CI/CD pipelines directly within the app. GitCanopy polls the GitHub API to show real-time status for the current branch.
              </p>
              <div className="bg-zed-element/30 dark:bg-zed-dark-element/30 p-4 rounded-lg border border-zed-border dark:border-zed-dark-border text-xs space-y-2 mt-4">
                <p className="font-bold text-zed-text dark:text-zed-dark-text">How to Connect:</p>
                <ol className="list-decimal list-inside space-y-1 text-zed-muted dark:text-zed-dark-muted ml-1">
                    <li>Generate a <strong>Personal Access Token (Classic)</strong> on GitHub.</li>
                    <li>Ensure the <code className="font-mono bg-zed-element dark:bg-zed-dark-element px-1 rounded">repo</code> scope is checked.</li>
                    <li>Click the <strong>Connect</strong> button in the top toolbar.</li>
                    <li>Paste your token. It is stored locally and securely.</li>
                </ol>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]"></span>
                    <span className="text-zed-text dark:text-zed-dark-text font-bold">Passed</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"></span>
                    <span className="text-zed-text dark:text-zed-dark-text font-bold">Failed</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                    <span className="text-zed-text dark:text-zed-dark-text font-bold">Running</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                    <span className="text-zed-text dark:text-zed-dark-text font-bold">Queued</span>
                </div>
            </div>
          </div>
        </section>

        {/* 08. AI Assistant */}
        <section className="space-y-8">
          <div className="flex items-baseline gap-4">
            <span className="text-xs font-mono text-zed-accent/50 dark:text-zed-dark-accent/50 font-bold">
              08
            </span>
            <h2 className="text-lg font-bold tracking-tight text-zed-text dark:text-zed-dark-text border-b border-zed-border dark:border-zed-dark-border pb-2 flex-grow">
              AI & Temporal Intelligence
            </h2>
          </div>

          <div className="space-y-8 pl-8 text-sm">
            <div className="space-y-3">
              <h3 className="font-bold text-zed-text dark:text-zed-dark-text uppercase text-[10px] tracking-widest">
                AI Command Center ({modKey}+J)
              </h3>
              <p className="text-zed-muted dark:text-zed-dark-muted leading-relaxed">
                A centralized, natural language interface for repository management. Instead of memorizing complex Git flags, you can simply type your intent.
              </p>
              <div className="bg-zed-element/20 dark:bg-zed-dark-element/20 p-4 rounded-lg border border-zed-border dark:border-zed-dark-border space-y-2">
                <p className="text-[10px] font-bold text-zed-accent uppercase">Example Queries:</p>
                <ul className="text-[11px] font-mono space-y-1 opacity-80">
                  <li>&quot;Undo my last commit but keep changes&quot;</li>
                  <li>&quot;Delete all branches already merged into main&quot;</li>
                  <li>&quot;Switch to my feature branch&quot;</li>
                </ul>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-bold text-zed-text dark:text-zed-dark-text uppercase text-[10px] tracking-widest">
                Git Time Machine
              </h3>
              <p className="text-zed-muted dark:text-zed-dark-muted leading-relaxed">
                A non-destructive temporal scrubber that allows you to &quot;time travel&quot; through your repository&apos;s history. Activating the Time Machine reveals a scrubber that rebuilds the graph visualization at any historical point.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-bold text-zed-text dark:text-zed-dark-text uppercase text-[10px] tracking-widest">
                Commit Message Generation
              </h3>
              <p className="text-zed-muted dark:text-zed-dark-muted leading-relaxed">
                Analyze staged changes to generate semantic commit messages. The engine follows the Conventional Commits spec, producing a concise summary and detailed bullet points automatically.
              </p>
            </div>
          </div>
        </section>

        {/* 09. Mycelia AI Agent & MCP */}
        <section className="space-y-8">
          <div className="flex items-baseline gap-4">
            <span className="text-xs font-mono text-zed-accent/50 dark:text-zed-dark-accent/50 font-bold">
              09
            </span>
            <h2 className="text-lg font-bold tracking-tight text-zed-text dark:text-zed-dark-text border-b border-zed-border dark:border-zed-dark-border pb-2 flex-grow">
              Mycelia AI Agent & MCP
            </h2>
          </div>

          <div className="space-y-8 pl-8 text-sm">
            <div className="space-y-3">
              <h3 className="font-bold text-zed-text dark:text-zed-dark-text uppercase text-[10px] tracking-widest">
                What is Mycelia?
              </h3>
              <p className="text-zed-muted dark:text-zed-dark-muted leading-relaxed">
                Mycelia is GitCanopy&apos;s integrated AI Agent designed to connect your local Git workspace with external tools and platforms. Using the Model Context Protocol (MCP), Mycelia automates cross-platform workflows, inspects system states, and runs advanced repository operations in response to simple prompts.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-bold text-zed-text dark:text-zed-dark-text uppercase text-[10px] tracking-widest">
                Connecting GitLab MCP Server
              </h3>
              <p className="text-zed-muted dark:text-zed-dark-muted leading-relaxed">
                Mycelia includes native support for the official GitLab MCP server. By linking your GitLab account, Mycelia can query and create issues, inspect merge requests, trigger CI/CD pipelines, and manage projects directly.
              </p>
              <div className="bg-zed-element/30 dark:bg-zed-dark-element/30 p-4 rounded-lg border border-zed-border dark:border-zed-dark-border text-xs space-y-2 mt-4">
                <p className="font-bold text-zed-text dark:text-zed-dark-text">Connecting GitLab:</p>
                <ol className="list-decimal list-inside space-y-1 text-zed-muted dark:text-zed-dark-muted ml-1">
                  <li>Generate a <strong>Personal Access Token</strong> on GitLab. Ensure the <code className="font-mono bg-zed-element dark:bg-zed-dark-element px-1 rounded text-zed-accent">api</code> scope is checked so GitCanopy can read data and create automated issues.</li>
                  <li>Go to <strong>Settings</strong> in the top bar.</li>
                  <li>Paste your token under the GitLab Agent configuration section.</li>
                  <li>Provide your <strong>GitLab Project ID</strong> or <strong>Project Path</strong> to auto-inject repository context.</li>
                  <li>The application will automatically launch and register the GitLab MCP server in the background.</li>
                </ol>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-bold text-zed-text dark:text-zed-dark-text uppercase text-[10px] tracking-widest">
                AI Formatting & Summarization
              </h3>
              <p className="text-zed-muted dark:text-zed-dark-muted leading-relaxed">
                By default, executing tools directly (e.g., using <code className="font-mono bg-zed-element dark:bg-zed-dark-element px-1 py-0.5 rounded text-zed-accent">@</code> commands) prints the raw JSON response. To transform this data into a professional, beautifully structured Markdown summary, you can configure an AI provider in Settings. Mycelia will automatically intercept and format the raw outputs.
              </p>
              <div className="bg-zed-element/30 dark:bg-zed-dark-element/30 p-4 rounded-lg border border-zed-border dark:border-zed-dark-border text-xs space-y-2 mt-4">
                <p className="font-bold text-zed-text dark:text-zed-dark-text">How to Enable Summarization:</p>
                <ol className="list-decimal list-inside space-y-1 text-zed-muted dark:text-zed-dark-muted ml-1">
                  <li>Go to <strong>Settings</strong> in the top bar.</li>
                  <li>Under <strong>AI Engine Configuration</strong>, choose your preferred AI Provider (e.g., <strong>Gemini</strong>, <strong>OpenAI</strong>, or <strong>Claude</strong>).</li>
                  <li>Paste the corresponding AI API Key (Gemini, OpenAI, or Claude depending on your chosen provider) and save the settings.</li>
                  <li>Subsequent tool outputs will automatically be summarized and decorated in the chat pane.</li>
                </ol>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-bold text-zed-text dark:text-zed-dark-text uppercase text-[10px] tracking-widest">
                Interaction Modes
              </h3>
              <p className="text-zed-muted dark:text-zed-dark-muted leading-relaxed">
                You can engage Mycelia in two ways inside the agent pane:
              </p>
              <ul className="list-disc list-inside space-y-2 text-zed-muted dark:text-zed-dark-muted pl-1">
                <li>
                  <strong>Agentic Chat (Natural Language):</strong> Describe your goal in plain English. Mycelia will use LLM-based reasoning to determine the optimal tool path, query the required parameters, call the tool locally, and format raw JSON into rich, elegant Markdown summaries.
                </li>
                <li>
                  <strong>Direct Command Syntax:</strong> Prefix commands with <code className="font-mono bg-zed-element dark:bg-zed-dark-element px-1.5 py-0.5 rounded text-zed-accent">@</code> to skip AI reasoning and call tools directly. Example: <code className="font-mono bg-zed-element dark:bg-zed-dark-element px-1.5 py-0.5 rounded">@gitlab_get_issue project_id=123 issue_id=456</code>.
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="font-bold text-zed-text dark:text-zed-dark-text uppercase text-[10px] tracking-widest">
                AI Assistance Tools
              </h3>
              <p className="text-zed-muted dark:text-zed-dark-muted leading-relaxed">
                GitCanopy provides two specialized AI tools to inspect your changes before committing. While they both use AI, they serve distinct purposes:
              </p>
              <div className="grid grid-cols-2 gap-6 mt-4">
                <div className="bg-zed-element/20 dark:bg-zed-dark-element/20 p-4 rounded border border-zed-border/30 dark:border-zed-dark-border/30">
                  <h4 className="text-[11px] font-bold text-zed-accent uppercase tracking-wider mb-2">Quality Review</h4>
                  <p className="text-[11px] leading-relaxed text-zed-muted dark:text-zed-dark-muted">
                    Acts as a <strong>Senior Engineer</strong>. Focuses on logic, performance, and clean code. Use this to catch architectural flaws, redundant logic, or style inconsistencies.
                  </p>
                </div>
                <div className="bg-zed-element/20 dark:bg-zed-dark-element/20 p-4 rounded border border-zed-border/30 dark:border-zed-dark-border/30">
                  <h4 className="text-[11px] font-bold text-rose-500 uppercase tracking-wider mb-2">AI Security Audit</h4>
                  <p className="text-[11px] leading-relaxed text-zed-muted dark:text-zed-dark-muted">
                    Acts as a <strong>Security Auditor</strong>. Focuses exclusively on safety. Use this to catch hardcoded secrets, SQL injections, or compliance violations before they leak.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-bold text-zed-text dark:text-zed-dark-text uppercase text-[10px] tracking-widest">
                Session Memory & Context
              </h3>
              <p className="text-zed-muted dark:text-zed-dark-muted leading-relaxed">
                Mycelia maintains a <strong>short-term memory</strong> of your active conversation to provide contextually relevant assistance.
              </p>
              <ul className="list-disc list-inside space-y-2 text-zed-muted dark:text-zed-dark-muted pl-1">
                <li>
                  <strong>Sliding Window:</strong> The agent remembers the last 10 messages in your current session. This allows you to ask follow-up questions or refer to previous results without re-explaining yourself.
                </li>
                <li>
                  <strong>Resetting Memory:</strong> You can clear the agent&apos;s memory at any time by typing <code className="font-mono bg-zed-element dark:bg-zed-dark-element px-1.5 py-0.5 rounded text-zed-accent">@clear</code> in the chat input. This wipes the chat history and starts a fresh session with no prior context.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* 10. Data Integrity & Security */}
        <section className="space-y-8 pb-12">
          <div className="flex items-baseline gap-4">
            <span className="text-xs font-mono text-zed-accent/50 dark:text-zed-dark-accent/50 font-bold">
              10
            </span>
            <h2 className="text-lg font-bold tracking-tight text-zed-text dark:text-zed-dark-text border-b border-zed-border dark:border-zed-dark-border pb-2 flex-grow">
              Data Integrity & Security
            </h2>
          </div>

          <div className="space-y-4 pl-8">
            <ul className="text-sm space-y-6">
              <li className="flex gap-6 items-start">
                <span className="text-zed-accent dark:text-zed-dark-accent font-mono text-xs font-black uppercase shrink-0 tracking-[0.2em] pt-1">
                  Shield
                </span>
                <p className="text-zed-muted dark:text-zed-dark-muted leading-relaxed font-medium">
                  <strong>Secure Interaction:</strong> GitCanopy prioritizes
                  repository integrity. While it supports standard staging and
                  committing, all graph navigation and data extraction (like
                  copying hashes) are strictly non-destructive operations.
                </p>
              </li>
              <li className="flex gap-6 items-start pt-4 border-t border-zed-border dark:border-zed-dark-border/50">
                <span className="text-zed-accent dark:text-zed-dark-accent font-mono text-xs font-black uppercase shrink-0 tracking-[0.2em] pt-1">
                  Local
                </span>
                <p className="text-zed-muted dark:text-zed-dark-muted leading-relaxed font-medium">
                  <strong>Offline First:</strong> Repository metadata never
                  leaves your machine. All calculations are performed against
                  your local Git binary. Identity settings and API keys are stored in your local application data or Git config.
                </p>
              </li>
            </ul>
          </div>
        </section>

        {/* Colophon */}
        <footer className="pt-20 space-y-4 text-center">
          <div className="flex justify-center gap-6">
            <button
              onClick={() =>
                window.gitcanopyAPI.openExternal(
                  "https://github.com/sponsors/TainYanTun",
                )
              }
              className="text-[10px] font-bold uppercase tracking-widest text-zed-accent dark:text-zed-dark-accent hover:underline transition-all"
            >
              • Support Development
            </button>
            <button
              onClick={() =>
                window.gitcanopyAPI.openExternal(
                  "https://github.com/TainYanTun/GitCanopy",
                )
              }
              className="text-[10px] font-bold uppercase tracking-widest text-zed-muted dark:text-zed-dark-muted hover:text-zed-text dark:hover:text-zed-dark-text transition-all"
            >
              • Star on GitHub
            </button>
          </div>
          <div className="text-[9px] font-mono uppercase tracking-[0.5em] text-zed-muted dark:text-zed-dark-muted opacity-40">
            GitCanopy Visualizer / Technical Manual / Rev 2026.05.23
          </div>
        </footer>
      </div>
    </div>
  );
};
