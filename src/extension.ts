import * as vscode from 'vscode';
import * as path from 'path';

// ==================== Types ====================

interface SecretPattern {
    id: string;
    name: string;
    regex: RegExp;
    defaultEnvVar: string;
    severity: vscode.DiagnosticSeverity;
}

// ==================== Pattern Registry ====================

const SECRET_PATTERNS: SecretPattern[] = [
    {
        id: 'openai-api-key',
        name: 'OpenAI API Key',
        regex: /sk-(?!ant-)(?:proj-)?[a-zA-Z0-9\-_]{20,}/,
        defaultEnvVar: 'OPENAI_API_KEY',
        severity: vscode.DiagnosticSeverity.Error,
    },
    {
        id: 'anthropic-api-key',
        name: 'Anthropic API Key',
        regex: /sk-ant-[a-zA-Z0-9\-_]{20,}/,
        defaultEnvVar: 'ANTHROPIC_API_KEY',
        severity: vscode.DiagnosticSeverity.Error,
    },
    {
        id: 'aws-access-key-id',
        name: 'AWS Access Key ID',
        regex: /\bAKIA[0-9A-Z]{16,}\b/,
        defaultEnvVar: 'AWS_ACCESS_KEY_ID',
        severity: vscode.DiagnosticSeverity.Error,
    },
    {
        id: 'google-api-key',
        name: 'Google API Key',
        regex: /AIza[0-9A-Za-z\-_]{33,}/,
        defaultEnvVar: 'GOOGLE_API_KEY',
        severity: vscode.DiagnosticSeverity.Error,
    },
    {
        id: 'github-token',
        name: 'GitHub Personal Access Token',
        regex: /ghp_[a-zA-Z0-9]{35,}/,
        defaultEnvVar: 'GITHUB_TOKEN',
        severity: vscode.DiagnosticSeverity.Error,
    },
    {
        id: 'github-fine-grained-token',
        name: 'GitHub Fine-grained Token',
        regex: /github_pat_[a-zA-Z0-9_]{82}/,
        defaultEnvVar: 'GITHUB_TOKEN',
        severity: vscode.DiagnosticSeverity.Error,
    },
    {
        id: 'stripe-secret-key',
        name: 'Stripe Secret Key',
        regex: /sk_live_[0-9a-zA-Z]{24,}/,
        defaultEnvVar: 'STRIPE_SECRET_KEY',
        severity: vscode.DiagnosticSeverity.Error,
    },
    {
        id: 'stripe-publishable-key',
        name: 'Stripe Publishable Key',
        regex: /pk_live_[0-9a-zA-Z]{24,}/,
        defaultEnvVar: 'STRIPE_PUBLISHABLE_KEY',
        severity: vscode.DiagnosticSeverity.Warning,
    },
    {
        id: 'huggingface-token',
        name: 'Hugging Face Token',
        regex: /hf_[a-zA-Z0-9]{30,}/,
        defaultEnvVar: 'HUGGINGFACE_TOKEN',
        severity: vscode.DiagnosticSeverity.Error,
    },
];

// Generic assignment pattern: catches `api_key = "value"`, `secret = 'value'`, etc.
// Capture group 1 is the secret value inside quotes.
const GENERIC_ASSIGNMENT_SOURCE =
    /(?:api[_\-]?key|api[_\-]?secret|secret[_\-]?key|access[_\-]?token|auth[_\-]?token|private[_\-]?key|openai[_\-]?key|claude[_\-]?key|gemini[_\-]?key)\s*[=:]\s*["']([a-zA-Z0-9+\/=_\-\.]{20,})["']/.source;

// ==================== Global State ====================

let diagnosticCollection: vscode.DiagnosticCollection;
let statusBarItem: vscode.StatusBarItem;
let totalIssueCount = 0;

// Per-document debounce timers to avoid scanning on every keystroke
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

// ==================== Activation ====================

export function activate(context: vscode.ExtensionContext) {
    console.log('VibeGuard is now active!');

    diagnosticCollection = vscode.languages.createDiagnosticCollection('vibeguard');
    context.subscriptions.push(diagnosticCollection);

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'vibeguard.scanWorkspace';
    updateStatusBar(0);
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    vscode.window.visibleTextEditors.forEach(editor => refreshDiagnostics(editor.document));
    checkGitignoreOnStartup();

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(e => refreshDiagnosticsDebounced(e.document)),
        vscode.workspace.onDidOpenTextDocument(doc => refreshDiagnostics(doc)),
        vscode.workspace.onDidSaveTextDocument(async doc => {
            refreshDiagnostics(doc);
            if (path.basename(doc.fileName) === '.env') {
                const root = getWorkspaceRoot();
                if (root) { await ensureGitignore(root); }
            }
        }),
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('vibeguard')) { refreshAllOpenDocuments(); }
        })
    );

    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            '*',
            new VibeGuardCodeActionProvider(),
            { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'vibeguard.moveToEnv',
            async (uri: any, range: any, patternId: string, keyValue: string) => {
                try {
                    await moveToEnv(resolveUri(uri), resolveRange(range), patternId, keyValue);
                } catch (err) {
                    vscode.window.showErrorMessage(`VibeGuard Error: ${err}`);
                }
            }
        ),
        vscode.commands.registerCommand('vibeguard.scanWorkspace', scanWorkspace)
    );
}

// ==================== Diagnostics ====================

function shouldScanFile(doc: vscode.TextDocument): boolean {
    if (doc.uri.scheme !== 'file' && doc.uri.scheme !== 'untitled') { return false; }
    const filePath = doc.uri.fsPath ?? doc.uri.path;
    const fileName = path.basename(filePath);

    if (fileName === '.env' || fileName.startsWith('.env.')) { return false; }
    if (filePath.includes('node_modules')) { return false; }
    if (fileName.endsWith('.min.js') || fileName.endsWith('.min.css')) { return false; }
    if (['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'].includes(fileName)) { return false; }

    return true;
}

function refreshDiagnosticsDebounced(doc: vscode.TextDocument): void {
    const key = doc.uri.toString();
    const existing = debounceTimers.get(key);
    if (existing) { clearTimeout(existing); }
    debounceTimers.set(key, setTimeout(() => {
        debounceTimers.delete(key);
        refreshDiagnostics(doc);
    }, 500));
}

function refreshDiagnostics(doc: vscode.TextDocument): void {
    const config = vscode.workspace.getConfiguration('vibeguard');
    if (!config.get<boolean>('enable', true)) {
        diagnosticCollection.clear();
        updateStatusBar(0);
        return;
    }

    if (!shouldScanFile(doc)) { return; }

    const text = doc.getText();
    const diagnostics: vscode.Diagnostic[] = [];

    for (const pattern of SECRET_PATTERNS) {
        const regex = new RegExp(pattern.regex.source, 'g');
        let match: RegExpExecArray | null;
        while ((match = regex.exec(text)) !== null) {
            const lineStart = text.lastIndexOf('\n', match.index) + 1;
            const contextBefore = text.substring(lineStart, match.index);
            if (isAlreadySafe(contextBefore)) { continue; }

            const startPos = doc.positionAt(match.index);
            const endPos = doc.positionAt(match.index + match[0].length);
            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(startPos, endPos),
                `VibeGuard: ${pattern.name} hardcoded! Move to .env to prevent leaks.`,
                pattern.severity
            );
            diagnostic.code = pattern.id;
            diagnostic.source = 'VibeGuard';
            diagnostics.push(diagnostic);
        }
    }

    const genericRegex = new RegExp(GENERIC_ASSIGNMENT_SOURCE, 'gi');
    let match: RegExpExecArray | null;
    while ((match = genericRegex.exec(text)) !== null) {
        const keyValue = match[1];
        const keyStartInText = match.index + match[0].length - keyValue.length - 1;
        const startPos = doc.positionAt(keyStartInText);
        const endPos = doc.positionAt(keyStartInText + keyValue.length);
        const range = new vscode.Range(startPos, endPos);

        const alreadyCovered = diagnostics.some(d => d.range.start.line === range.start.line);
        if (alreadyCovered) { continue; }

        const lineStart2 = text.lastIndexOf('\n', keyStartInText) + 1;
        const contextBefore = text.substring(lineStart2, keyStartInText);
        if (isAlreadySafe(contextBefore)) { continue; }

        const diagnostic = new vscode.Diagnostic(
            range,
            'VibeGuard: Hardcoded secret in variable assignment! Move to .env for security.',
            vscode.DiagnosticSeverity.Warning
        );
        diagnostic.code = 'generic-secret';
        diagnostic.source = 'VibeGuard';
        diagnostics.push(diagnostic);
    }

    diagnosticCollection.set(doc.uri, diagnostics);
    updateTotalIssueCount();
}

function isAlreadySafe(contextBefore: string): boolean {
    return /process\.env\.|os\.getenv\(|os\.Getenv\(|getenv\(|ENV\[|std::env::var\(/.test(contextBefore);
}

function updateTotalIssueCount(): void {
    let total = 0;
    diagnosticCollection.forEach((_uri, diags) => { total += diags.length; });
    totalIssueCount = total;
    updateStatusBar(total);
}

function updateStatusBar(count: number): void {
    if (count === 0) {
        statusBarItem.text = '$(shield) VibeGuard';
        statusBarItem.tooltip = 'VibeGuard: No secrets detected. Click to scan workspace.';
        statusBarItem.backgroundColor = undefined;
    } else {
        statusBarItem.text = `$(shield) VibeGuard: ${count} issue${count !== 1 ? 's' : ''}`;
        statusBarItem.tooltip = `VibeGuard: ${count} hardcoded secret${count !== 1 ? 's' : ''} detected! Click to scan workspace.`;
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
}

function refreshAllOpenDocuments(): void {
    vscode.workspace.textDocuments.forEach(doc => refreshDiagnostics(doc));
}

// ==================== Code Action Provider ====================

class VibeGuardCodeActionProvider implements vscode.CodeActionProvider {
    provideCodeActions(
        document: vscode.TextDocument,
        _range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<(vscode.Command | vscode.CodeAction)[]> {
        return context.diagnostics
            .filter(d => d.source === 'VibeGuard')
            .map(diagnostic => this.createFix(document, diagnostic));
    }

    private createFix(document: vscode.TextDocument, diagnostic: vscode.Diagnostic): vscode.CodeAction {
        const fix = new vscode.CodeAction('VibeGuard: Move to .env', vscode.CodeActionKind.QuickFix);
        fix.diagnostics = [diagnostic];
        fix.isPreferred = true;

        const keyValue = document.getText(diagnostic.range);
        const patternId = typeof diagnostic.code === 'string' ? diagnostic.code : 'unknown';

        fix.command = {
            command: 'vibeguard.moveToEnv',
            title: 'Move to .env',
            arguments: [document.uri, diagnostic.range, patternId, keyValue],
        };

        return fix;
    }
}

// ==================== Move to Env (Core Logic) ====================

async function moveToEnv(
    uri: vscode.Uri,
    range: vscode.Range,
    patternId: string,
    keyValue: string
): Promise<void> {
    const document = await vscode.workspace.openTextDocument(uri);

    const suggestedName = inferEnvVarName(document, range, patternId);
    const config = vscode.workspace.getConfiguration('vibeguard');
    let varName: string;

    if (config.get<boolean>('confirmVariableName', true)) {
        const input = await vscode.window.showInputBox({
            prompt: 'Environment variable name for this secret',
            value: suggestedName,
            validateInput: v =>
                /^[A-Z][A-Z0-9_]*$/.test(v) ? null : 'Use UPPER_SNAKE_CASE (e.g. OPENAI_API_KEY)',
        });
        if (input === undefined) { return; }
        varName = input;
    } else {
        varName = suggestedName;
    }

    const root = getWorkspaceRoot();
    if (!root) {
        vscode.window.showWarningMessage('VibeGuard: No workspace folder open. Cannot save to .env');
        return;
    }

    const actualVarName = await writeToEnvFile(root, varName, keyValue);

    const actualRange = expandRangeForQuotes(document, range);
    const replacement = buildReplacement(uri.fsPath, actualVarName);

    const keyEdit = new vscode.WorkspaceEdit();
    keyEdit.replace(uri, actualRange, replacement);
    const success = await vscode.workspace.applyEdit(keyEdit);
    if (!success) {
        throw new Error('Failed to apply edit. The file may be read-only.');
    }

    const docAfterKeyEdit = await vscode.workspace.openTextDocument(uri);
    const importEdit = new vscode.WorkspaceEdit();
    addImportIfNeeded(uri, docAfterKeyEdit, importEdit);
    await vscode.workspace.applyEdit(importEdit);

    await ensureGitignore(root);

    if (/\.go$/.test(uri.fsPath)) {
        if (!/"os"/.test(docAfterKeyEdit.getText())) {
            vscode.window.showInformationMessage('VibeGuard: Add `import "os"` to your Go file.');
        }
    }

    const renamedNote = actualVarName !== varName
        ? ` (renamed to ${actualVarName} to avoid conflict)`
        : '';

    const openBtn = 'Open .env';
    const msg = await vscode.window.showInformationMessage(
        `VibeGuard: ${actualVarName} saved to .env${renamedNote} and code updated.`,
        openBtn
    );
    if (msg === openBtn) {
        vscode.window.showTextDocument(vscode.Uri.file(path.join(root, '.env')));
    }
}

// Infers environment variable name from surrounding code context.
// Looks backward from the key position to find the nearest identifier.
// e.g. `api_key = "sk-..."` → API_KEY
// e.g. `OpenAI(api_key="sk-...")` → API_KEY (not OPEN_AI)
function inferEnvVarName(
    document: vscode.TextDocument,
    range: vscode.Range,
    patternId: string
): string {
    const pattern = SECRET_PATTERNS.find(p => p.id === patternId);
    const defaultName = pattern?.defaultEnvVar ?? 'API_KEY';

    const line = document.lineAt(range.start.line).text;
    const textBeforeKey = line.substring(0, range.start.character);
    const m = textBeforeKey.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*[=:]\s*["'`]?\s*$/);
    if (m && m[1]) {
        const skip = new Set(['const', 'let', 'var', 'val', 'return', 'export', 'default', 'new', 'true', 'false']);
        if (!skip.has(m[1])) {
            return toUpperSnakeCase(m[1]);
        }
    }
    return defaultName;
}

function toUpperSnakeCase(name: string): string {
    return name
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .replace(/[-\s]+/g, '_')
        .replace(/[^a-zA-Z0-9_]/g, '')
        .toUpperCase();
}

function expandRangeForQuotes(document: vscode.TextDocument, range: vscode.Range): vscode.Range {
    if (range.start.line !== range.end.line) { return range; }

    const lineText = document.lineAt(range.start.line).text;
    const startChar = range.start.character;
    const endChar = range.end.character;

    if (startChar === 0 || endChar >= lineText.length) { return range; }

    const before = lineText[startChar - 1];
    const after = lineText[endChar];
    const isMatchingQuote =
        before === after && (before === '"' || before === "'" || before === '`');

    if (isMatchingQuote) {
        return new vscode.Range(
            new vscode.Position(range.start.line, startChar - 1),
            new vscode.Position(range.end.line, endChar + 1)
        );
    }
    return range;
}

function buildReplacement(filePath: string, varName: string): string {
    if (/\.(js|ts|jsx|tsx|mjs|cjs)$/.test(filePath)) {
        return `process.env.${varName}`;
    } else if (/\.go$/.test(filePath)) {
        return `os.Getenv("${varName}")`;
    } else if (/\.php$/.test(filePath)) {
        return `getenv('${varName}')`;
    } else if (/\.rb$/.test(filePath)) {
        return `ENV['${varName}']`;
    } else if (/\.java$/.test(filePath)) {
        return `System.getenv("${varName}")`;
    } else if (/\.cs$/.test(filePath)) {
        return `Environment.GetEnvironmentVariable("${varName}")`;
    } else if (/\.rs$/.test(filePath)) {
        return `std::env::var("${varName}").unwrap()`;
    } else {
        return `os.getenv("${varName}")`; // Python / default
    }
}

function addImportIfNeeded(
    uri: vscode.Uri,
    document: vscode.TextDocument,
    edit: vscode.WorkspaceEdit
): void {
    const filePath = uri.fsPath;
    const text = document.getText();

    if (/\.py$/.test(filePath)) {
        const hasOsImport = /^import\s+os\b/m.test(text) || /^from\s+os\s+import/m.test(text);
        if (!hasOsImport) {
            edit.insert(uri, findPythonImportInsertPosition(document), 'import os\n');
        }
    }
}

function findPythonImportInsertPosition(document: vscode.TextDocument): vscode.Position {
    let lastImportLine = -1;
    const limit = Math.min(document.lineCount, 200);
    for (let i = 0; i < limit; i++) {
        const lineText = document.lineAt(i).text;
        if (/^(?:import|from)\s+/.test(lineText)) {
            lastImportLine = i;
        }
    }
    return new vscode.Position(lastImportLine + 1, 0);
}

async function writeToEnvFile(root: string, varName: string, keyValue: string): Promise<string> {
    const envUri = vscode.Uri.file(path.join(root, '.env'));
    let content = '';
    try {
        const data = await vscode.workspace.fs.readFile(envUri);
        content = Buffer.from(data).toString('utf8');
    } catch {
        content = '';
    }

    const escapedKey = escapeRegex(keyValue);
    const existingEntry = content.match(new RegExp(`^([A-Z_][A-Z0-9_]*)=${escapedKey}\\s*$`, 'm'));
    if (existingEntry) {
        return existingEntry[1];
    }

    let finalVarName = varName;
    let counter = 2;
    while (new RegExp(`^${escapeRegex(finalVarName)}=`, 'm').test(content)) {
        finalVarName = `${varName}_${counter++}`;
    }

    const prefix = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
    await vscode.workspace.fs.writeFile(
        envUri,
        Buffer.from(content + `${prefix}${finalVarName}=${keyValue}\n`, 'utf8')
    );
    return finalVarName;
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ==================== Workspace Scan ====================

async function scanWorkspace(): Promise<void> {
    const root = getWorkspaceRoot();
    if (!root) {
        vscode.window.showWarningMessage('VibeGuard: No workspace folder open.');
        return;
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'VibeGuard: Scanning workspace...',
            cancellable: true,
        },
        async (progress, token) => {
            const files = await vscode.workspace.findFiles(
                '**/*',
                '{**/node_modules/**,**/.git/**,**/*.min.js,**/*.lock,**/dist/**,**/build/**,**/.env,**/.env.*}'
            );

            let scanned = 0;
            for (const fileUri of files) {
                if (token.isCancellationRequested) { break; }
                try {
                    const doc = await vscode.workspace.openTextDocument(fileUri);
                    refreshDiagnostics(doc);
                } catch {
                    // Skip binary/unreadable files
                }
                scanned++;
                progress.report({
                    increment: (scanned / files.length) * 100,
                    message: path.basename(fileUri.fsPath),
                });
            }

            updateTotalIssueCount();
            vscode.window.showInformationMessage(
                `VibeGuard: Scanned ${scanned} files — ${totalIssueCount} issue${totalIssueCount !== 1 ? 's' : ''} found.`
            );
        }
    );
}

// ==================== Gitignore Helpers ====================

async function ensureGitignore(root: string): Promise<void> {
    const gitignoreUri = vscode.Uri.file(path.join(root, '.gitignore'));
    let content = '';
    try {
        content = Buffer.from(await vscode.workspace.fs.readFile(gitignoreUri)).toString('utf8');
    } catch {
        content = '';
    }

    const lines = content.split(/\r?\n/);
    if (lines.some(l => l.trim() === '.env')) { return; }

    const prefix = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
    await vscode.workspace.fs.writeFile(
        gitignoreUri,
        Buffer.from(content + prefix + '.env\n', 'utf8')
    );
    vscode.window.showInformationMessage('VibeGuard: Added .env to .gitignore');
}

async function checkGitignoreOnStartup(): Promise<void> {
    const root = getWorkspaceRoot();
    if (!root) { return; }

    try {
        await vscode.workspace.fs.stat(vscode.Uri.file(path.join(root, '.env')));
    } catch {
        return;
    }

    let gitignoreContent = '';
    try {
        gitignoreContent = Buffer.from(
            await vscode.workspace.fs.readFile(vscode.Uri.file(path.join(root, '.gitignore')))
        ).toString('utf8');
    } catch {
        gitignoreContent = '';
    }

    const hasEnvEntry = gitignoreContent.split(/\r?\n/).some(l => l.trim() === '.env');
    if (!hasEnvEntry) {
        const addBtn = 'Add to .gitignore';
        const choice = await vscode.window.showWarningMessage(
            'VibeGuard: .env file found but not in .gitignore! Your secrets may be exposed.',
            addBtn
        );
        if (choice === addBtn) { await ensureGitignore(root); }
    }
}

// ==================== Utilities ====================

function getWorkspaceRoot(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function resolveUri(uriOrDoc: any): vscode.Uri {
    if (uriOrDoc instanceof vscode.Uri) { return uriOrDoc; }
    if (uriOrDoc?.uri instanceof vscode.Uri) { return uriOrDoc.uri; }
    return vscode.Uri.file(uriOrDoc.path ?? uriOrDoc.fsPath);
}

function resolveRange(r: any): vscode.Range {
    if (r instanceof vscode.Range) { return r; }
    const start = r.start ?? r[0];
    const end = r.end ?? r[1];
    return new vscode.Range(
        new vscode.Position(start.line, start.character),
        new vscode.Position(end.line, end.character)
    );
}

export function deactivate() { }
