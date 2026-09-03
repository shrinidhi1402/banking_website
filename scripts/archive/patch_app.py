import re

filepath = r"src\App.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Import
if "import CRQDashboard from './CRQDashboard.jsx'" not in content:
    content = content.replace("import './App.css'", "import './App.css'\nimport CRQDashboard from './CRQDashboard.jsx'")

# 2. Add to Manager nav
if "'CRQ Dashboard'" not in content:
    content = content.replace("'Bug Lab']", "'Bug Lab', 'CRQ Dashboard']")

# 3. Add to WorkspacePage routing
if "<CRQDashboard " not in content:
    # Find the Bug Lab route and insert CRQ Dashboard below it
    bug_lab_route = "else if (active === 'Bug Lab'    && isMgr)             Content = <BugLabPanel session={session} action={action} onSecretFlagChange={onSecretFlagChange} />"
    crq_route = "    else if (active === 'CRQ Dashboard' && isMgr)          Content = <CRQDashboard session={session} action={action} />"
    content = content.replace(bug_lab_route, f"{bug_lab_route}\n{crq_route}")
    
    # Also fix the page-intro symbol if necessary
    intro_check = "active === 'Reports' ? '??' : '??'"
    new_intro = "active === 'CRQ Dashboard' ? '???' : active === 'Reports' ? '??' : '??'"
    content = content.replace(intro_check, new_intro)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
