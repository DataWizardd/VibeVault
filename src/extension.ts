import * as vscode from 'vscode';
import * as path from 'path';

let diagnosticCollection: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext) {
    console.log('VibeGuard is now active!');

    diagnosticCollection = vscode.languages.createDiagnosticCollection('vibeguard');
    context.subscriptions.push(diagnosticCollection);

    // Initial scan
    if (vscode.window.activeTextEditor) {
        refreshDiagnostics(vscode.window.activeTextEditor.document, diagnosticCollection);
    }
    vscode.window.visibleTextEditors.forEach(editor => {
        refreshDiagnostics(editor.document, diagnosticCollection);
    });

    // Listeners
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            refreshDiagnostics(event.document, diagnosticCollection);
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(doc => {
            refreshDiagnostics(doc, diagnosticCollection);
        })
    );

    // Configuration change listener
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('vibeguard.enable')) {
                if (vscode.window.activeTextEditor) {
                    refreshDiagnostics(vscode.window.activeTextEditor.document, diagnosticCollection);
                }
            }
        })
    );

    // Code Action Provider
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            '*',
            new VibeGuardCodeActionProvider(),
            { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
        )
    );

    // Command
    context.subscriptions.push(
        vscode.commands.registerCommand('vibeguard.moveToEnv', async (uri: vscode.Uri, range: vscode.Range, apiKey: string) => {
            await moveToEnv(uri, range, apiKey);
        })
    );
}

function refreshDiagnostics(doc: vscode.TextDocument, collection: vscode.DiagnosticCollection): void {
    const config = vscode.workspace.getConfiguration('vibeguard');
    if (!config.get<boolean>('enable')) {
        collection.clear();
        return;
    }

    // Don't scan huge files or non-code files if possible, but for MVP we scan all text docs
    if (doc.uri.scheme !== 'file' && doc.uri.scheme !== 'untitled') {
        return;
    }

    const text = doc.getText();
    const diagnostics: vscode.Diagnostic[] = [];

    // Robust Regex for OpenAI Keys (Standard and Project keys)
    // sk-proj-... is variable length, sk-... is usually 51 chars but can vary.
    // We look for sk- followed by at least 20 chars of base64-ish set.
    const regex = /sk-(proj-)?[a-zA-Z0-9\-_]{20,}/g;

    let match;
    while ((match = regex.exec(text)) !== null) {
        const startPos = doc.positionAt(match.index);
        const endPos = doc.positionAt(match.index + match[0].length);
        const range = new vscode.Range(startPos, endPos);

        const diagnostic = new vscode.Diagnostic(
            range,
            'VibeGuard: Hardcoded API Key detected! Move to .env for security.',
            vscode.DiagnosticSeverity.Warning
        );
        diagnostic.code = 'api-key-leak';
        diagnostic.source = 'VibeGuard';
        diagnostics.push(diagnostic);
    }

    collection.set(doc.uri, diagnostics);
}

class VibeGuardCodeActionProvider implements vscode.CodeActionProvider {
    provideCodeActions(document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.ProviderResult<(vscode.Command | vscode.CodeAction)[]> {
        return context.diagnostics
            .filter(diagnostic => diagnostic.code === 'api-key-leak')
            .map(diagnostic => this.createFix(document, diagnostic));
    }

    private createFix(document: vscode.TextDocument, diagnostic: vscode.Diagnostic): vscode.CodeAction {
        const fix = new vscode.CodeAction('Move to .env', vscode.CodeActionKind.QuickFix);
        fix.diagnostics = [diagnostic];
        fix.isPreferred = true;

        const apiKey = document.getText(diagnostic.range);

        fix.command = {
            command: 'vibeguard.moveToEnv',
            title: 'Move to .env',
            arguments: [document.uri, diagnostic.range, apiKey]
        };

        return fix;
    }
}

async function moveToEnv(uri: vscode.Uri, range: vscode.Range, apiKey: string) {
    const config = vscode.workspace.getConfiguration('vibeguard');
    const varName = config.get<string>('variableName') || 'OPENAI_API_KEY';

    // 1. Replace code in editor
    const edit = new vscode.WorkspaceEdit();

    // Determine language to decide replacement syntax (Simple heuristic for MVP)
    // Python: os.getenv("KEY")
    // JS/TS: process.env.KEY
    // Go: os.Getenv("KEY")
    // For now, consistent with Python user request, but we can detect based on file extension
    let replacement = `os.getenv("${varName}")`;
    if (uri.path.endsWith('.js') || uri.path.endsWith('.ts') || uri.path.endsWith('.jsx') || uri.path.endsWith('.tsx')) {
        replacement = `process.env.${varName}`;
    } else if (uri.path.endsWith('.go')) {
        replacement = `os.Getenv("${varName}")`;
    } else if (uri.path.endsWith('.php')) {
        replacement = `getenv('${varName}')`;
    }

    // Fallback to python style if unknown, or just keep the user request logic
    if (uri.path.endsWith('.py')) {
        replacement = `os.getenv("${varName}")`;
    }

    edit.replace(uri, range, replacement);

    const success = await vscode.workspace.applyEdit(edit);
    if (!success) {
        vscode.window.showErrorMessage('VibeGuard: Failed to replace code.');
        return;
    }

    // 2. Update .env
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showWarningMessage('VibeGuard: No workspace folder open. Cannot save .env');
        return;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const envPath = path.join(rootPath, '.env');
    const envUri = vscode.Uri.file(envPath);

    let envContent = '';
    try {
        const readData = await vscode.workspace.fs.readFile(envUri);
        envContent = Buffer.from(readData).toString('utf8');
    } catch (error) {
        envContent = '';
    }

    // Check for existence
    if (envContent.includes(`${varName}=`) || envContent.includes(apiKey)) {
        // If key value exists, we are good. If varName exists, we might overwrite? 
        // For safety, if varName exists, we warn or append with comment?
        // MVP: If key exists, do nothing. If varName exists, append likely duplicates.
        if (envContent.includes(apiKey)) {
            vscode.window.showInformationMessage(`VibeGuard: Key moved. Value already detected in .env.`);
            return;
        }
    }

    const prefix = (envContent.length > 0 && !envContent.endsWith('\n')) ? '\n' : '';
    const newEntry = `${prefix}${varName}=${apiKey}\n`;
    const newContent = envContent + newEntry;

    await vscode.workspace.fs.writeFile(envUri, Buffer.from(newContent, 'utf8'));

    // Optional: Ask user if they want to open .env
    const openBtn = 'Open .env';
    vscode.window.showInformationMessage(`VibeGuard: Moved to .env as ${varName}`, openBtn).then(selection => {
        if (selection === openBtn) {
            vscode.window.showTextDocument(envUri);
        }
    });
}

export function deactivate() { }
