import { useState, useEffect, useRef } from 'react';

const CRQ_API = 'http://localhost:8000/api/v1';

export default function CRQDashboard({ session, action }) {
  const [summary, setSummary] = useState(null);
  const [contributors, setContributors] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // AI Chat State
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { role: 'assistant', text: 'I am the CRQ AI Assistant. Ask me about your top risks, asset vulnerabilities, or simulate a remediation scenario.' }
  ]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  // WebSocket State
  const [wsStatus, setWsStatus] = useState('disconnected');
  const wsRef = useRef(null);

  const fetchRiskData = async () => {
    try {
      // Risk Summary
      const resSummary = await fetch(`${CRQ_API}/risk/summary?scope=org`);
      if (resSummary.ok) {
        setSummary(await resSummary.json());
      }
      
      // Top Contributors
      const resContrib = await fetch(`${CRQ_API}/risk/contributors?top=5`);
      if (resContrib.ok) {
        setContributors((await resContrib.json()).items || []);
      }
    } catch (err) {
      console.error("Failed to fetch CRQ data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiskData();
    
    // Connect to WebSocket for real-time EAL updates
    // In dev, use the bypass token or assume auth is disabled on backend
    const ws = new WebSocket(`ws://localhost:8000/ws/updates?org_id=1&token=dev-bypass`);
    
    ws.onopen = () => setWsStatus('connected');
    ws.onclose = () => setWsStatus('disconnected');
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.topic === 'eal.updated' || msg.topic === 'risk.alert') {
          // Re-fetch data when EAL changes
          fetchRiskData();
          
          // Optionally add a notification to chat
          setChatHistory(prev => [...prev, {
            role: 'system',
            text: `[SYSTEM ALERT] Risk state mutated. New EAL: ${formatINR(msg.new_eal)} (${msg.delta_pct > 0 ? '+' : ''}${msg.delta_pct}%)`
          }]);
        }
      } catch(e) { /* ignore */ }
    };
    
    wsRef.current = ws;
    return () => ws.close();
  }, []);
  
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleAskAI = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    const query = chatInput.trim();
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: query }]);
    setChatLoading(true);
    
    try {
      const res = await fetch(`${CRQ_API}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      
      if (!res.ok) throw new Error("AI query failed");
      
      const data = await res.json();
      setChatHistory(prev => [...prev, { role: 'assistant', text: data.answer }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'assistant', text: "Sorry, I encountered an error connecting to the AI Gateway." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const formatINR = (val) => {
    if (val === undefined || val === null) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  if (loading) {
    return <div className="card"><p>Initializing FAIR Monte Carlo Engine...</p></div>;
  }

  return (
    <div className="crq-dashboard" style={{ display: 'flex', gap: '24px', height: '100%' }}>
      
      {/* Left Column: Risk Metrics */}
      <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eaeaea', paddingBottom: '12px', marginBottom: '16px' }}>
            <h3 style={{ margin: 0 }}>Portfolio Expected Annual Loss (EAL)</h3>
            <span style={{ fontSize: '12px', color: wsStatus === 'connected' ? 'green' : 'red', fontWeight: 'bold' }}>
              ● {wsStatus === 'connected' ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
          
          <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#111827' }}>
            {formatINR(summary?.eal)}
          </div>
          <div style={{ marginTop: '12px', color: '#4b5563', display: 'flex', justifyContent: 'space-between' }}>
            <span>95% VaR: <strong>{formatINR(summary?.var_95)}</strong></span>
            <span>Based on <strong>10,000</strong> simulations</span>
          </div>
        </div>

        <div className="card" style={{ flex: '1' }}>
          <h3 style={{ marginTop: 0 }}>Top Risk Contributors</h3>
          <table className="data-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #eaeaea' }}>
                <th style={{ padding: '8px 0' }}>Asset / Vulnerability</th>
                <th style={{ padding: '8px 0', textAlign: 'right' }}>EAL Contribution</th>
              </tr>
            </thead>
            <tbody>
              {contributors.map((c, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #eaeaea' }}>
                  <td style={{ padding: '12px 0' }}>
                    <div style={{ fontWeight: '500' }}>{c.scope_id}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>{c.scope}</div>
                  </td>
                  <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 'bold' }}>
                    {formatINR(c.contribution_value)}
                  </td>
                </tr>
              ))}
              {contributors.length === 0 && (
                <tr>
                  <td colSpan="2" style={{ padding: '24px 0', textAlign: 'center', color: '#6b7280' }}>
                    No significant risks detected.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right Column: AI Assistant */}
      <div className="card" style={{ width: '400px', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ marginTop: 0, borderBottom: '1px solid #eaeaea', paddingBottom: '12px' }}>CRQ AI Assistant</h3>
        
        <div style={{ flex: '1', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 0', maxHeight: '500px' }}>
          {chatHistory.map((msg, i) => (
            <div key={i} style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              backgroundColor: msg.role === 'user' ? '#111827' : msg.role === 'system' ? '#fee2e2' : '#f3f4f6',
              color: msg.role === 'user' ? '#fff' : msg.role === 'system' ? '#b91c1c' : '#111827',
              padding: '12px 16px',
              borderRadius: '8px',
              maxWidth: '85%',
              fontSize: '14px',
              lineHeight: '1.5'
            }}>
              {msg.text}
            </div>
          ))}
          {chatLoading && (
            <div style={{ alignSelf: 'flex-start', backgroundColor: '#f3f4f6', padding: '12px 16px', borderRadius: '8px', fontSize: '14px' }}>
              <span className="dot-typing">Thinking...</span>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={handleAskAI} style={{ display: 'flex', gap: '8px', marginTop: '16px', borderTop: '1px solid #eaeaea', paddingTop: '16px' }}>
          <input 
            type="text" 
            className="text-input" 
            placeholder="Ask a question..." 
            value={chatInput} 
            onChange={e => setChatInput(e.target.value)}
            disabled={chatLoading}
            style={{ flex: '1' }}
          />
          <button type="submit" className="primary-button" disabled={chatLoading || !chatInput.trim()}>
            Send
          </button>
        </form>
      </div>

    </div>
  );
}
