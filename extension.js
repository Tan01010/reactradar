const vscode = require("vscode");

let webviewPanel = null;
let statusBarButton = null;

function activate(context) {
  const command = vscode.commands.registerCommand("reactradar.scanFile", () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage("No active editor found.");
      return;
    }
    const document = editor.document;
    if (!["javascriptreact", "typescriptreact"].includes(document.languageId)) {
      vscode.window.showInformationMessage("Not a React file.");
      return;
    }
    analyzeReactCode(document);
  });

  const openSidebar = vscode.commands.registerCommand(
    "reactradar.openSidebar",
    () => {
      if (!webviewPanel) {
        webviewPanel = vscode.window.createWebviewPanel(
          "reactCodeCheckerResults",
          "React Code Checker Results",
          vscode.ViewColumn.Beside,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
          }
        );
        webviewPanel.onDidDispose(() => {
          webviewPanel = null;
        });
      } else {
        webviewPanel.dispose();
        webviewPanel = vscode.window.createWebviewPanel(
          "reactCodeCheckerResults",
          "React Code Checker Results",
          vscode.ViewColumn.Beside,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
          }
        );
        webviewPanel.onDidDispose(() => {
          webviewPanel = null;
        });
      }

      webviewPanel.webview.html = getWebviewContent();
    }
  );

  statusBarButton = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarButton.text = "$(checklist) Scan React Code";
  statusBarButton.command = "reactradar.scanFile";
  statusBarButton.tooltip = "Scan React Code for issues";
  statusBarButton.show();

  context.subscriptions.push(command, openSidebar, statusBarButton);
}

function analyzeReactCode(document) {
  const code = document.getText();
	console.log(code)
  const issues = [];

  // Skip over comments and string literals
  const codeWithoutCommentsAndStrings = removeCommentsAndStrings(code);

  // Check for missing 'key' prop in list rendering
  const mapRegex = /\.map\((.*?)=>/g;
  let match;
  while ((match = mapRegex.exec(codeWithoutCommentsAndStrings)) !== null) {
    const itemBlock = match[1].trim();
    // const mapStartPos = document.positionAt(match.index);

    // Calculate line/column positions correctly by keeping track of removed content
    const actualLine = document.positionAt(match.index).line + 2;

    if (!new RegExp(`${itemBlock}\\s*\\{.*?key=`, "s").test(codeWithoutCommentsAndStrings)) {
      issues.push({
        type: "warning",
        message: `Missing 'key' prop in list rendering for item: "${itemBlock}" (Line: ${actualLine})`,
      });
    }
  }

  // Check for incorrect hook usage
  const hookRegex = /\buse[A-Z]\w*\b/g;
  const hookMatches = [];
  while ((match = hookRegex.exec(codeWithoutCommentsAndStrings)) !== null) {
    hookMatches.push({ hook: match[0], index: match.index });
  }

  hookMatches.forEach((match) => {
    const hook = match.hook;
    const hookPos = document.positionAt(match.index);
    
    // Check if the hook is used at the top level of the functional component
    const funcStartPos = codeWithoutCommentsAndStrings.slice(0, match.index).lastIndexOf("function");
    if (funcStartPos === -1 || codeWithoutCommentsAndStrings.slice(funcStartPos, match.index).includes("if") || codeWithoutCommentsAndStrings.slice(funcStartPos, match.index).includes("else")) {
      issues.push({
        type: "error",
        message: `Incorrect usage of hook: "${hook}" (hooks must be called inside functional components) (Line: ${hookPos.line + 1})`,
      });
    }
  });

  // If issues found, store them and open the sidebar
  if (issues.length > 0) {
    vscode.commands.executeCommand("reactradar.openSidebar");
    if (webviewPanel) {
      webviewPanel.webview.postMessage({ type: "setResults", results: issues });
    }
  }
}

function removeCommentsAndStrings(code) {
  // Replace comments, string literals, and import statements with placeholders to preserve line numbers
  return code
    .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "//COMMENT") // Replace comments with a placeholder
    .replace(/(['"]).*?\1/g, "\"STRING\"") // Replace strings with a placeholder
    .replace(/import\s+.*?from\s+['"][^'"]+['"];?/g, "import IGNORE"); // Replace import statements with a placeholder
}


function getWebviewContent() {
  return `
    <!DOCTYPE html>
    <html lang="en">
        <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>React Code Checker Results</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 1rem; }
                h1 { font-size: 20px; color: #007acc; }
                .warning { color: orange; }
                .error { color: red; }
                .issue { margin-bottom: 10px; }
            </style>
        </head>
        <body>
            <h1>React Code Checker Results</h1>
            <div id="results"></div>
            <script>
                const vscode = acquireVsCodeApi();
                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.type === 'setResults') {
                        const resultsDiv = document.getElementById('results');
                        resultsDiv.innerHTML = ''; 
                        message.results.forEach(issue => {
                            const div = document.createElement('div');
                            div.classList.add('issue');
                            div.classList.add(issue.type);
                            div.textContent = issue.message;
                            resultsDiv.appendChild(div);
                        });
                    }
                });
            </script>
        </body>
    </html>`;
}

function deactivate() {}

module.exports = { activate, deactivate };
