import re

filepath = r"src\App.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# In BugLabPanel, there's a handleToggle function. Let's patch it.
# Note: there seem to be two handleToggle functions in the file based on the previous output, we'll patch the BugLabPanel one.

crq_dispatch_code = """
        // --- CRQ INGESTION TRIGGER ---
        // Automatically dispatch risk events to the FAIR Monte Carlo engine when bugs are toggled
        try {
          const isNowOn = !!data.flags[flag];
          let eventType = null;
          let payload = null;
          
          if (flag === 'BUG_MFA') {
            eventType = isNowOn ? 'control.disabled' : 'control.updated';
            payload = {
              control: 'mfa',
              status: isNowOn ? 'disabled' : 'enabled',
              coverage_pct: isNowOn ? 0 : 95,
              config_quality: isNowOn ? 0 : 0.95,
              asset_id: 1 // Core Banking System
            };
          } else if (flag === 'BUG_SQLI') {
             eventType = isNowOn ? 'control.disabled' : 'control.updated';
             payload = {
                control: 'waf',
                status: isNowOn ? 'disabled' : 'enabled',
                coverage_pct: isNowOn ? 0 : 90,
                config_quality: isNowOn ? 0 : 0.9,
                asset_id: 2 // Customer Portal
             }
          }

          if (eventType) {
            fetch('http://localhost:8000/api/v1/events', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event_id: crypto.randomUUID(),
                event_type: eventType,
                org_id: 1,
                source: "Northstar BugLab",
                payload: payload
              })
            }).catch(e => console.log('CRQ Backend offline:', e));
          }
        } catch (e) { console.error('Failed to notify CRQ', e); }
        // -----------------------------
"""

# Replace the part inside handleToggle
# Find: const data = await apiPost('/bugs/toggle', { flag }, token)
#       setFlags(data.flags)

new_handle_toggle = f"""const data = await apiPost('/bugs/toggle', {{ flag }}, token)
        setFlags(data.flags){crq_dispatch_code}"""

content = content.replace("const data = await apiPost('/bugs/toggle', { flag }, token)\n        setFlags(data.flags)", new_handle_toggle)


with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
