import { useState, useEffect, useCallback } from "react";

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#0d1117", surface: "#161b22", card: "#1c2330", border: "#30363d",
  accent: "#f0883e", accentDim: "#3d2000", red: "#f85149", green: "#3fb950",
  yellow: "#e3b341", blue: "#58a6ff", purple: "#bc8cff",
  muted: "#8b949e", text: "#e6edf3", textDim: "#c9d1d9",
};

const severityConfig = {
  "Near Miss":         { color: C.yellow,   bg: "#332a00",  icon: "⚠️" },
  "First Aid":         { color: C.blue,     bg: "#001d3d",  icon: "🩹" },
  "Medical Treatment": { color: C.accent,   bg: "#2d1a00",  icon: "🏥" },
  "Lost Time Injury":  { color: C.red,      bg: "#2d0f0f",  icon: "🚑" },
  "Fatality":          { color: "#ff0055",  bg: "#1a0010",  icon: "💀" },
};

const INCIDENT_TYPES = [
  "Struck By","Struck Against","Caught In/Between","Fall from Height",
  "Fall on Same Level","Electrical","Fire/Explosion","Chemical Exposure",
  "Manual Handling","Vehicle Accident","Equipment Failure","Near Miss",
  "Environmental Release","Ergonomic","Pressure/Pneumatic","Other",
];
const AREAS = [
  "Fabrication Workshop","Blasting & Painting","Yard/Laydown",
  "Lifting Operations","Electrical Room","Warehouse","Site Office",
  "Client Site","Loading/Unloading","Workshop Office",
];
const DEPARTMENTS = [
  "Fabrication","Welding","Blasting & Painting","Mechanical","Electrical",
  "Lifting/Rigging","HSE","QC/QA","Engineering","Logistics","Administration",
];
const TAPROOT_CATS = [
  "Management System","Procedures/Documentation","Training/Knowledge",
  "Equipment/Materials","Work Environment","Human Factors",
  "Communication","Leadership/Supervision",
];

// ─── API bridge (works both in Electron and browser fallback) ─────────────────
const isElectron = typeof window !== 'undefined' && window.hseAPI;

const Storage = {
  async getAll() {
    if (isElectron) return window.hseAPI.getAllIncidents();
    return JSON.parse(localStorage.getItem('hse_incidents') || '[]');
  },
  async save(incident) {
    if (isElectron) return window.hseAPI.saveIncident(incident);
    const all = JSON.parse(localStorage.getItem('hse_incidents') || '[]');
    const idx = all.findIndex(i => i.id === incident.id);
    if (idx >= 0) all[idx] = incident; else all.unshift(incident);
    localStorage.setItem('hse_incidents', JSON.stringify(all));
    return { success: true };
  },
  async delete(id) {
    if (isElectron) return window.hseAPI.deleteIncident(id);
    const all = JSON.parse(localStorage.getItem('hse_incidents') || '[]').filter(i => i.id !== id);
    localStorage.setItem('hse_incidents', JSON.stringify(all));
    return { success: true };
  },
  async export() {
    if (isElectron) return window.hseAPI.exportIncidents();
    const data = localStorage.getItem('hse_incidents') || '[]';
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `HSE_Backup_${new Date().toISOString().split('T')[0]}.json`; a.click();
    return { success: true };
  },
  async getSettings() {
    if (isElectron) return window.hseAPI.getSettings();
    return JSON.parse(localStorage.getItem('hse_settings') || '{"company":"My Company","department":"HSE Department","location":"Qatar"}');
  },
  async saveSettings(s) {
    if (isElectron) return window.hseAPI.saveSettings(s);
    localStorage.setItem('hse_settings', JSON.stringify(s));
    return { success: true };
  },
};

// ─── Utilities ────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().split('T')[0];
const autoRef = () => `INC-${new Date().getFullYear()}-${String(Math.floor(Math.random()*9000)+1000)}`;

// ─── Shared UI ────────────────────────────────────────────────────────────────
const Field = ({ label, children, required, half }) => (
  <div style={{ marginBottom: 14, gridColumn: half ? "span 1" : "span 2" }}>
    <label style={{ display:"block", fontSize:11, fontWeight:700, letterSpacing:1,
      color:C.muted, textTransform:"uppercase", marginBottom:5 }}>
      {label}{required && <span style={{color:C.red}}> *</span>}
    </label>
    {children}
  </div>
);

const inp = { width:"100%", boxSizing:"border-box", background:C.bg, border:`1px solid ${C.border}`,
  borderRadius:6, color:C.text, padding:"8px 11px", fontSize:13, outline:"none", fontFamily:"inherit" };

const Input = (p) => <input {...p} style={{...inp, ...p.style}} />;
const Textarea = (p) => <textarea {...p} rows={p.rows||3} style={{...inp, resize:"vertical", ...p.style}} />;
const Select = ({ value, onChange, options, placeholder }) => (
  <select value={value} onChange={onChange}
    style={{...inp, cursor:"pointer", color: value ? C.text : C.muted}}>
    {placeholder && <option value="">{placeholder}</option>}
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
);

const Btn = ({ children, onClick, variant="primary", disabled, small, full }) => {
  const v = {
    primary:   { background:C.accent, color:"#fff", border:"none" },
    secondary: { background:"transparent", color:C.accent, border:`1px solid ${C.accent}` },
    danger:    { background:"transparent", color:C.red, border:`1px solid ${C.red}` },
    ghost:     { background:"transparent", color:C.muted, border:`1px solid ${C.border}` },
    green:     { background:"transparent", color:C.green, border:`1px solid ${C.green}` },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...v[variant], borderRadius:6, padding: small ? "4px 11px" : "8px 18px",
      fontSize: small ? 12 : 13, fontWeight:600, cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1, fontFamily:"inherit", whiteSpace:"nowrap",
      width: full ? "100%" : "auto",
    }}>{children}</button>
  );
};

const Badge = ({ label, color, bg }) => (
  <span style={{background:bg||"transparent", color, borderRadius:4,
    padding:"2px 8px", fontSize:11, fontWeight:700, letterSpacing:0.4, border:`1px solid ${color}22`}}>
    {label}
  </span>
);

const Toast = ({ msg, type, onDone }) => {
  useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t); }, []);
  return (
    <div style={{position:"fixed", bottom:24, right:24, background: type==="error" ? C.red : C.green,
      color:"#fff", padding:"12px 20px", borderRadius:8, fontSize:13, fontWeight:600,
      boxShadow:"0 4px 20px #0008", zIndex:9999, maxWidth:320}}>
      {type==="error" ? "✕ " : "✓ "}{msg}
    </div>
  );
};

// ─── 5-Why ────────────────────────────────────────────────────────────────────
const FiveWhy = ({ whys, setWhys }) => (
  <div>
    {whys.map((w, i) => (
      <div key={i} style={{display:"flex", gap:12, marginBottom:14, alignItems:"flex-start"}}>
        <div style={{minWidth:34, height:34, borderRadius:"50%",
          background: i===4 ? C.accentDim : C.border,
          border:`2px solid ${i===4 ? C.accent : C.border}`,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:13, fontWeight:800, color: i===4 ? C.accent : C.muted, marginTop:3}}>
          {i+1}
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:10, color:C.muted, marginBottom:4, fontWeight:700, letterSpacing:1}}>
            WHY {i+1}{i===0 ? " — PROBLEM" : i===4 ? " — ROOT CAUSE" : ""}
          </div>
          <Textarea value={w} rows={2}
            onChange={e => { const n=[...whys]; n[i]=e.target.value; setWhys(n); }}
            placeholder={i===0 ? "Why did the incident occur?" : i===4 ? "What is the fundamental root cause?" : "Why did that happen?"} />
        </div>
      </div>
    ))}
  </div>
);

// ─── TapRoot selector ─────────────────────────────────────────────────────────
const TapRoot = ({ selected, setSelected }) => (
  <div style={{display:"flex", flexWrap:"wrap", gap:8}}>
    {TAPROOT_CATS.map(cat => {
      const on = selected.includes(cat);
      return (
        <button key={cat} onClick={() => setSelected(on ? selected.filter(x=>x!==cat) : [...selected,cat])}
          style={{background: on?C.accentDim:C.bg, color: on?C.accent:C.muted,
            border:`1px solid ${on?C.accent:C.border}`, borderRadius:20,
            padding:"5px 14px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit"}}>
          {cat}
        </button>
      );
    })}
  </div>
);

// ─── Timeline ─────────────────────────────────────────────────────────────────
const Timeline = ({ events, setEvents }) => {
  const add = () => setEvents([...events, {id:uid(), time:"", actor:"", description:""}]);
  const upd = (id,f,v) => setEvents(events.map(e=>e.id===id?{...e,[f]:v}:e));
  const del = (id) => setEvents(events.filter(e=>e.id!==id));
  return (
    <div>
      <div style={{borderLeft:`2px solid ${C.border}`, paddingLeft:20, marginLeft:6}}>
        {events.map((ev,i) => (
          <div key={ev.id} style={{position:"relative", marginBottom:18}}>
            <div style={{position:"absolute", left:-27, top:10, width:12, height:12,
              borderRadius:"50%", background:C.accent, border:`2px solid ${C.bg}`}} />
            <div style={{background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:14}}>
              <div style={{display:"flex", gap:10, marginBottom:8, alignItems:"center"}}>
                <Input value={ev.time} onChange={e=>upd(ev.id,"time",e.target.value)}
                  placeholder="Time" style={{flex:1}} />
                <Input value={ev.actor} onChange={e=>upd(ev.id,"actor",e.target.value)}
                  placeholder="Person / Equipment" style={{flex:2}} />
                <Btn variant="danger" small onClick={()=>del(ev.id)}>✕</Btn>
              </div>
              <Textarea value={ev.description} onChange={e=>upd(ev.id,"description",e.target.value)}
                placeholder="What happened at this point?" rows={2} />
            </div>
          </div>
        ))}
      </div>
      <Btn variant="secondary" onClick={add}>+ Add Event</Btn>
    </div>
  );
};

// ─── Evidence ─────────────────────────────────────────────────────────────────
const Evidence = ({ items, setItems }) => {
  const add = () => setItems([...items, {id:uid(), type:"Photo", description:"", ref:""}]);
  const upd = (id,f,v) => setItems(items.map(e=>e.id===id?{...e,[f]:v}:e));
  const del = (id) => setItems(items.filter(e=>e.id!==id));
  return (
    <div>
      {items.map(ev => (
        <div key={ev.id} style={{display:"flex", gap:10, marginBottom:10, alignItems:"center"}}>
          <div style={{width:160}}>
            <Select value={ev.type} onChange={e=>upd(ev.id,"type",e.target.value)}
              options={["Photo","Video","Witness Statement","Document","Physical Sample","CCTV","Medical Report","Toolbox Talk Record"]} />
          </div>
          <Input value={ev.description} onChange={e=>upd(ev.id,"description",e.target.value)}
            placeholder="Description" style={{flex:3}} />
          <Input value={ev.ref} onChange={e=>upd(ev.id,"ref",e.target.value)}
            placeholder="Ref #" style={{flex:1}} />
          <Btn variant="danger" small onClick={()=>del(ev.id)}>✕</Btn>
        </div>
      ))}
      <Btn variant="secondary" onClick={add}>+ Add Evidence</Btn>
    </div>
  );
};

// ─── Actions ──────────────────────────────────────────────────────────────────
const Actions = ({ actions, setActions }) => {
  const add = () => setActions([...actions, {id:uid(), action:"", responsible:"", dueDate:"", priority:"Medium", status:"Open"}]);
  const upd = (id,f,v) => setActions(actions.map(a=>a.id===id?{...a,[f]:v}:a));
  const del = (id) => setActions(actions.filter(a=>a.id!==id));
  return (
    <div>
      {actions.map(a => (
        <div key={a.id} style={{background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:14, marginBottom:12}}>
          <Textarea value={a.action} onChange={e=>upd(a.id,"action",e.target.value)}
            placeholder="Corrective / Preventive action description..." rows={2}
            style={{marginBottom:10}} />
          <div style={{display:"flex", gap:10, flexWrap:"wrap", alignItems:"center"}}>
            <Input value={a.responsible} onChange={e=>upd(a.id,"responsible",e.target.value)}
              placeholder="Responsible person" style={{flex:2}} />
            <Input type="date" value={a.dueDate} onChange={e=>upd(a.id,"dueDate",e.target.value)} style={{flex:1}} />
            <div style={{width:110}}>
              <Select value={a.priority} onChange={e=>upd(a.id,"priority",e.target.value)}
                options={["Critical","High","Medium","Low"]} />
            </div>
            <div style={{width:120}}>
              <Select value={a.status} onChange={e=>upd(a.id,"status",e.target.value)}
                options={["Open","In Progress","Closed","Overdue"]} />
            </div>
            <Btn variant="danger" small onClick={()=>del(a.id)}>✕</Btn>
          </div>
        </div>
      ))}
      <Btn variant="secondary" onClick={add}>+ Add Action</Btn>
    </div>
  );
};

// ─── INCIDENT FORM ────────────────────────────────────────────────────────────
const STEPS = ["Incident Details","Event Timeline","Evidence","5-Why Analysis","TapRoot & Causes","Corrective Actions","Review & Save"];

function IncidentForm({ initial, onSave, onCancel, settings }) {
  const [step, setStep] = useState(0);
  const blank = {
    id:uid(), reportNo:autoRef(), date:today(), time:"", location:"", area:"",
    severity:"", type:"", description:"", injuredPerson:"", designation:"",
    department:"", bodyPart:"", firstAid:"", witnesses:"", reportedBy:"",
    supervisor:"", events:[], evidence:[], whys:["","","","",""],
    taproot:[], immediateCase:"", contributingFactors:"", rootCause:"",
    actions:[], status:"Draft", createdAt:new Date().toISOString(),
  };
  const [f, setF] = useState(initial || blank);
  const set = (k,v) => setF(p => ({...p,[k]:v}));

  const SHead = ({title, sub}) => (
    <div style={{marginBottom:22}}>
      <div style={{fontSize:16, fontWeight:700, color:C.text}}>{title}</div>
      {sub && <div style={{fontSize:12, color:C.muted, marginTop:4}}>{sub}</div>}
    </div>
  );

  const renderStep = () => {
    switch(step) {
      case 0: return (
        <>
          <SHead title="📋 Basic Incident Information" sub="Fill all required fields to create a complete incident record" />
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 20px"}}>
            <Field label="Report Number" half><Input value={f.reportNo} readOnly style={{opacity:.6}} /></Field>
            <Field label="Date of Incident" required half><Input type="date" value={f.date} onChange={e=>set("date",e.target.value)} /></Field>
            <Field label="Time" half><Input type="time" value={f.time} onChange={e=>set("time",e.target.value)} /></Field>
            <Field label="Severity" required half>
              <Select value={f.severity} onChange={e=>set("severity",e.target.value)} options={Object.keys(severityConfig)} placeholder="Select severity..." />
            </Field>
            <Field label="Incident Type" required half>
              <Select value={f.type} onChange={e=>set("type",e.target.value)} options={INCIDENT_TYPES} placeholder="Select type..." />
            </Field>
            <Field label="Area" half>
              <Select value={f.area} onChange={e=>set("area",e.target.value)} options={AREAS} placeholder="Select area..." />
            </Field>
            <Field label="Exact Location" half><Input value={f.location} onChange={e=>set("location",e.target.value)} placeholder="e.g. Bay 3 – Welding Station" /></Field>
            <Field label="Department" half>
              <Select value={f.department} onChange={e=>set("department",e.target.value)} options={DEPARTMENTS} placeholder="Select department..." />
            </Field>
            <Field label="Incident Description" required>
              <Textarea value={f.description} onChange={e=>set("description",e.target.value)} rows={4}
                placeholder="Describe what happened — include sequence of events, equipment involved, and immediate consequences..." />
            </Field>
            <Field label="Injured / Involved Person" half><Input value={f.injuredPerson} onChange={e=>set("injuredPerson",e.target.value)} placeholder="Full name" /></Field>
            <Field label="Designation" half><Input value={f.designation} onChange={e=>set("designation",e.target.value)} placeholder="e.g. Welder Grade II" /></Field>
            <Field label="Body Part Affected" half><Input value={f.bodyPart} onChange={e=>set("bodyPart",e.target.value)} placeholder="e.g. Right hand" /></Field>
            <Field label="First Aid Given" half><Input value={f.firstAid} onChange={e=>set("firstAid",e.target.value)} placeholder="Describe treatment" /></Field>
            <Field label="Witnesses" half><Input value={f.witnesses} onChange={e=>set("witnesses",e.target.value)} placeholder="Names of witnesses" /></Field>
            <Field label="Supervisor on Duty" half><Input value={f.supervisor} onChange={e=>set("supervisor",e.target.value)} placeholder="Name" /></Field>
            <Field label="Reported By" half><Input value={f.reportedBy} onChange={e=>set("reportedBy",e.target.value)} placeholder="Name" /></Field>
          </div>
        </>
      );
      case 1: return (
        <>
          <SHead title="⏱ Event Timeline" sub="Reconstruct the sequence of events leading up to and including the incident" />
          <Timeline events={f.events} setEvents={v=>set("events",v)} />
        </>
      );
      case 2: return (
        <>
          <SHead title="📎 Evidence Collected" sub="Document all physical, digital, and testimonial evidence gathered during investigation" />
          <Evidence items={f.evidence} setItems={v=>set("evidence",v)} />
        </>
      );
      case 3: return (
        <>
          <SHead title="🔍 5-Why Root Cause Analysis" sub="Start with the incident, ask 'Why?' five times. Each answer becomes the next question." />
          <FiveWhy whys={f.whys} setWhys={v=>set("whys",v)} />
        </>
      );
      case 4: return (
        <>
          <SHead title="🌳 TapRoot Causal Categories" sub="Select all applicable categories, then document immediate cause and root cause" />
          <Field label="TapRoot Categories — Select all that apply">
            <TapRoot selected={f.taproot} setSelected={v=>set("taproot",v)} />
          </Field>
          <Field label="Immediate Cause (Unsafe Act / Unsafe Condition)">
            <Textarea value={f.immediateCase} onChange={e=>set("immediateCase",e.target.value)} rows={3}
              placeholder="The direct proximate cause..." />
          </Field>
          <Field label="Contributing Factors">
            <Textarea value={f.contributingFactors} onChange={e=>set("contributingFactors",e.target.value)} rows={3}
              placeholder="Factors that contributed to or worsened the incident..." />
          </Field>
          <Field label="Root Cause Statement">
            <Textarea value={f.rootCause} onChange={e=>set("rootCause",e.target.value)} rows={3}
              placeholder="The fundamental systemic reason — derived from 5-Why analysis..." />
          </Field>
        </>
      );
      case 5: return (
        <>
          <SHead title="✅ Corrective & Preventive Actions (CAPA)" sub="Assign actions to prevent recurrence. Set owners, due dates, and priorities." />
          <Actions actions={f.actions} setActions={v=>set("actions",v)} />
        </>
      );
      case 6: {
        const sm = severityConfig[f.severity] || {};
        return (
          <>
            <SHead title="📄 Review & Submit" sub="Verify all information before saving" />
            <div style={{background:C.bg, border:`1px solid ${C.border}`, borderRadius:10, padding:20, marginBottom:20}}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14}}>
                <div>
                  <div style={{fontSize:18, fontWeight:800, color:C.text}}>{f.reportNo}</div>
                  <div style={{color:C.muted, fontSize:12, marginTop:3}}>{f.date} {f.time && `at ${f.time}`} · {f.area || f.location}</div>
                </div>
                {f.severity && <Badge label={`${sm.icon||""} ${f.severity}`} color={sm.color} bg={sm.bg} />}
              </div>
              <p style={{color:C.textDim, fontSize:13, marginBottom:16}}>{f.description || <i style={{color:C.muted}}>No description</i>}</p>
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12}}>
                {[["Type",f.type],["Department",f.department],["Area",f.area],
                  ["Injured",f.injuredPerson],["Supervisor",f.supervisor],["Reported By",f.reportedBy]
                ].map(([k,v]) => (
                  <div key={k}><div style={{fontSize:10, color:C.muted, fontWeight:700}}>{k}</div>
                  <div style={{color:C.text, fontSize:13}}>{v||"—"}</div></div>
                ))}
              </div>
            </div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:20}}>
              {[["Timeline Events",f.events.length,C.blue],["Evidence Items",f.evidence.length,C.purple],["CAPA Actions",f.actions.length,C.green]].map(([k,v,col]) => (
                <div key={k} style={{background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:14, textAlign:"center"}}>
                  <div style={{fontSize:28, fontWeight:800, color:col}}>{v}</div>
                  <div style={{fontSize:12, color:C.muted}}>{k}</div>
                </div>
              ))}
            </div>
            <div style={{display:"flex", gap:12}}>
              <Btn variant="ghost" onClick={() => onSave({...f, status:"Draft"})}>💾 Save as Draft</Btn>
              <Btn onClick={() => onSave({...f, status:"Submitted"})}>✓ Submit Report</Btn>
            </div>
          </>
        );
      }
      default: return null;
    }
  };

  return (
    <div style={{maxWidth:820, margin:"0 auto"}}>
      {/* Step bar */}
      <div style={{display:"flex", borderBottom:`1px solid ${C.border}`, paddingBottom:18, marginBottom:28, overflowX:"auto"}}>
        {STEPS.map((s,i) => (
          <div key={i} onClick={()=>setStep(i)} style={{flex:1, minWidth:90, textAlign:"center", cursor:"pointer", padding:"0 4px"}}>
            <div style={{width:26, height:26, borderRadius:"50%", margin:"0 auto 5px",
              background: i<step ? C.accent : i===step ? C.accent : C.border,
              border:`2px solid ${i<=step ? C.accent : C.border}`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:11, fontWeight:700, color: i<=step ? "#fff" : C.muted}}>
              {i<step ? "✓" : i+1}
            </div>
            <div style={{fontSize:9, color: i===step ? C.accent : C.muted, fontWeight: i===step ? 700 : 400, lineHeight:1.3, letterSpacing:0.3}}>
              {s.toUpperCase()}
            </div>
          </div>
        ))}
      </div>

      <div style={{marginBottom:28, minHeight:300}}>{renderStep()}</div>

      <div style={{display:"flex", justifyContent:"space-between", borderTop:`1px solid ${C.border}`, paddingTop:18}}>
        <div style={{display:"flex", gap:10}}>
          {onCancel && <Btn variant="ghost" onClick={onCancel}>✕ Cancel</Btn>}
          {step > 0 && <Btn variant="ghost" onClick={()=>setStep(step-1)}>← Back</Btn>}
        </div>
        {step < STEPS.length-1 && <Btn onClick={()=>setStep(step+1)}>Next →</Btn>}
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ incidents }) {
  const total = incidents.length;
  const bySev={}, byType={}, byArea={}, byDept={}, byMonth={}, tapCounts={};
  let openActions=0, overdueActions=0;

  incidents.forEach(inc => {
    const m = (inc.date||"").slice(0,7);
    if(m) byMonth[m]=(byMonth[m]||0)+1;
    if(inc.severity) bySev[inc.severity]=(bySev[inc.severity]||0)+1;
    if(inc.type) byType[inc.type]=(byType[inc.type]||0)+1;
    if(inc.area) byArea[inc.area]=(byArea[inc.area]||0)+1;
    if(inc.department) byDept[inc.department]=(byDept[inc.department]||0)+1;
    (inc.taproot||[]).forEach(t=>{tapCounts[t]=(tapCounts[t]||0)+1;});
    (inc.actions||[]).forEach(a=>{
      if(a.status==="Open"||a.status==="In Progress") openActions++;
      if(a.status==="Overdue") overdueActions++;
    });
  });

  const nearMiss = bySev["Near Miss"]||0;
  const lti = (bySev["Lost Time Injury"]||0)+(bySev["Fatality"]||0);
  const months = Object.entries(byMonth).sort().slice(-8);
  const maxM = Math.max(...months.map(x=>x[1]),1);

  const Bar = ({data, colorFn}) => {
    const max = Math.max(...data.map(d=>d.v),1);
    return data.map((d,i) => (
      <div key={i} style={{marginBottom:9}}>
        <div style={{display:"flex", justifyContent:"space-between", marginBottom:3}}>
          <span style={{fontSize:12, color:C.textDim, maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{d.k}</span>
          <span style={{fontSize:12, fontWeight:700, color: colorFn?colorFn(d.k):C.accent}}>{d.v}</span>
        </div>
        <div style={{background:C.bg, borderRadius:3, height:7, overflow:"hidden"}}>
          <div style={{height:"100%", width:`${(d.v/max)*100}%`, background: colorFn?colorFn(d.k):C.accent, borderRadius:3, transition:"width .5s"}} />
        </div>
      </div>
    ));
  };

  const KPI = ({label, val, color, sub}) => (
    <div style={{background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:18}}>
      <div style={{fontSize:30, fontWeight:800, color:color||C.text, fontFamily:"'IBM Plex Mono',monospace"}}>{val}</div>
      <div style={{fontSize:12, fontWeight:600, color:C.textDim, marginTop:3}}>{label}</div>
      {sub && <div style={{fontSize:11, color:C.muted, marginTop:3}}>{sub}</div>}
    </div>
  );

  if (total === 0) return (
    <div style={{textAlign:"center", padding:"80px 0"}}>
      <div style={{fontSize:56, marginBottom:16}}>📋</div>
      <div style={{fontSize:18, fontWeight:700, color:C.textDim}}>No Incidents Recorded</div>
      <div style={{fontSize:13, color:C.muted, marginTop:8}}>Create your first incident report to see analytics here</div>
    </div>
  );

  return (
    <div>
      <div style={{display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:12, marginBottom:20}}>
        <KPI label="Total Incidents" val={total} />
        <KPI label="Near Misses" val={nearMiss} color={C.yellow} sub="Leading indicator" />
        <KPI label="LTI / Fatality" val={lti} color={C.red} />
        <KPI label="Open Actions" val={openActions} color={openActions>0?C.accent:C.green} />
        <KPI label="Overdue Actions" val={overdueActions} color={overdueActions>0?C.red:C.green} sub={overdueActions>0?"Needs attention":"All on track"} />
      </div>

      {months.length > 1 && (
        <div style={{background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:20, marginBottom:16}}>
          <div style={{fontSize:11, fontWeight:700, color:C.muted, letterSpacing:1, textTransform:"uppercase", marginBottom:16}}>Monthly Trend</div>
          <div style={{display:"flex", alignItems:"flex-end", gap:8, height:90}}>
            {months.map(([m,v]) => (
              <div key={m} style={{flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4}}>
                <div style={{fontSize:11, color:C.accent, fontWeight:700}}>{v}</div>
                <div style={{width:"100%", background:C.accent, borderRadius:"3px 3px 0 0", height:`${(v/maxM)*65}px`, minHeight:4}} />
                <div style={{fontSize:10, color:C.muted}}>{m.slice(5)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginBottom:14}}>
        <div style={{background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:18}}>
          <div style={{fontSize:11, fontWeight:700, color:C.muted, letterSpacing:1, textTransform:"uppercase", marginBottom:14}}>By Severity</div>
          <Bar data={Object.entries(bySev).sort((a,b)=>b[1]-a[1]).map(([k,v])=>({k,v}))} colorFn={l=>severityConfig[l]?.color||C.accent} />
        </div>
        <div style={{background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:18}}>
          <div style={{fontSize:11, fontWeight:700, color:C.muted, letterSpacing:1, textTransform:"uppercase", marginBottom:14}}>By Incident Type</div>
          <Bar data={Object.entries(byType).sort((a,b)=>b[1]-a[1]).slice(0,7).map(([k,v])=>({k,v}))} />
        </div>
        <div style={{background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:18}}>
          <div style={{fontSize:11, fontWeight:700, color:C.muted, letterSpacing:1, textTransform:"uppercase", marginBottom:14}}>By Area</div>
          <Bar data={Object.entries(byArea).sort((a,b)=>b[1]-a[1]).slice(0,7).map(([k,v])=>({k,v}))} colorFn={()=>C.blue} />
        </div>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:14}}>
        <div style={{background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:18}}>
          <div style={{fontSize:11, fontWeight:700, color:C.muted, letterSpacing:1, textTransform:"uppercase", marginBottom:14}}>TapRoot Root Causes</div>
          {Object.keys(tapCounts).length > 0
            ? <Bar data={Object.entries(tapCounts).sort((a,b)=>b[1]-a[1]).map(([k,v])=>({k,v}))} colorFn={()=>C.red} />
            : <div style={{color:C.muted, fontSize:13}}>No TapRoot data yet</div>}
        </div>
        <div style={{background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:18}}>
          <div style={{fontSize:11, fontWeight:700, color:C.muted, letterSpacing:1, textTransform:"uppercase", marginBottom:14}}>Near Miss Proactive Ratio</div>
          <p style={{fontSize:12, color:C.textDim, marginBottom:14}}>Target: &gt;10 near misses per LTI indicates strong safety culture.</p>
          <div style={{display:"flex", gap:24}}>
            <div><div style={{fontSize:26, fontWeight:800, color:C.yellow, fontFamily:"monospace"}}>{nearMiss}</div><div style={{fontSize:11, color:C.muted}}>Near Misses</div></div>
            <div><div style={{fontSize:26, fontWeight:800, color:C.red, fontFamily:"monospace"}}>{lti}</div><div style={{fontSize:11, color:C.muted}}>LTI + Fatal</div></div>
            <div><div style={{fontSize:26, fontWeight:800, color:C.green, fontFamily:"monospace"}}>{lti===0?"✓":`${(nearMiss/lti).toFixed(1)}x`}</div><div style={{fontSize:11, color:C.muted}}>Ratio</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── INCIDENT LIST ────────────────────────────────────────────────────────────
function IncidentList({ incidents, onNew, onView, onEdit, onDelete }) {
  const [q, setQ] = useState("");
  const [sev, setSev] = useState("");
  const [status, setStatus] = useState("");

  const list = incidents.filter(i =>
    (!q || [i.reportNo,i.description,i.injuredPerson,i.type,i.area].join(" ").toLowerCase().includes(q.toLowerCase())) &&
    (!sev || i.severity === sev) &&
    (!status || i.status === status)
  );

  return (
    <div>
      <div style={{display:"flex", gap:12, marginBottom:18, flexWrap:"wrap"}}>
        <Input value={q} onChange={e=>setQ(e.target.value)} placeholder="🔍  Search incidents..." style={{flex:1, minWidth:200}} />
        <div style={{width:170}}><Select value={sev} onChange={e=>setSev(e.target.value)} options={Object.keys(severityConfig)} placeholder="All Severities" /></div>
        <div style={{width:130}}><Select value={status} onChange={e=>setStatus(e.target.value)} options={["Draft","Submitted"]} placeholder="All Status" /></div>
        <Btn onClick={onNew}>+ New Report</Btn>
      </div>

      {list.length === 0 ? (
        <div style={{textAlign:"center", padding:"60px 0", color:C.muted}}>
          <div style={{fontSize:40, marginBottom:12}}>🗂️</div>
          <div style={{fontSize:15, color:C.textDim}}>{incidents.length===0 ? "No incidents yet" : "No records match your filter"}</div>
          {incidents.length===0 && <div style={{marginTop:16}}><Btn onClick={onNew}>Create First Report</Btn></div>}
        </div>
      ) : list.map(inc => {
        const sm = severityConfig[inc.severity] || {};
        return (
          <div key={inc.id} style={{background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:16, marginBottom:10}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:7, flexWrap:"wrap"}}>
                  <span style={{fontWeight:700, color:C.text, fontFamily:"'IBM Plex Mono',monospace"}}>{inc.reportNo}</span>
                  {inc.severity && <Badge label={`${sm.icon||""} ${inc.severity}`} color={sm.color} bg={sm.bg} />}
                  <Badge label={inc.status} color={inc.status==="Submitted"?C.green:C.yellow} bg={inc.status==="Submitted"?"#0d2b14":"#332a00"} />
                </div>
                <div style={{color:C.muted, fontSize:11, marginBottom:5}}>
                  {inc.date}{inc.time&&` · ${inc.time}`}{inc.area&&` · ${inc.area}`}{inc.type&&` · ${inc.type}`}
                </div>
                <p style={{color:C.textDim, fontSize:13, margin:0, WebkitLineClamp:2, display:"-webkit-box", WebkitBoxOrient:"vertical", overflow:"hidden"}}>
                  {inc.description||"No description provided"}
                </p>
                {inc.injuredPerson && <div style={{fontSize:11, color:C.muted, marginTop:5}}>👤 {inc.injuredPerson}{inc.designation&&` (${inc.designation})`}</div>}
              </div>
              <div style={{display:"flex", gap:8, marginLeft:14, flexShrink:0}}>
                <Btn small variant="secondary" onClick={()=>onView(inc)}>View</Btn>
                <Btn small variant="ghost" onClick={()=>onEdit(inc)}>Edit</Btn>
                <Btn small variant="danger" onClick={()=>onDelete(inc.id)}>Delete</Btn>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── INCIDENT DETAIL ──────────────────────────────────────────────────────────
function IncidentDetail({ inc, onBack, onEdit }) {
  const sm = severityConfig[inc.severity] || {};
  const S = ({title, children}) => (
    <div style={{background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:18, marginBottom:14}}>
      <div style={{fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:1, marginBottom:14}}>{title}</div>
      {children}
    </div>
  );
  const KV = ({k,v}) => v ? (
    <div style={{marginBottom:10}}>
      <div style={{fontSize:10, color:C.muted, fontWeight:700, letterSpacing:0.5}}>{k}</div>
      <div style={{color:C.text, fontSize:13, marginTop:2}}>{v}</div>
    </div>
  ) : null;

  return (
    <div style={{maxWidth:820, margin:"0 auto"}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20}}>
        <Btn variant="ghost" onClick={onBack}>← Back to List</Btn>
        <Btn variant="secondary" onClick={onEdit}>✏️ Edit Report</Btn>
      </div>

      <div style={{background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:22, marginBottom:14}}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:20, fontWeight:800, color:C.text, fontFamily:"'IBM Plex Mono',monospace"}}>{inc.reportNo}</div>
            <div style={{color:C.muted, fontSize:12, marginTop:4}}>{inc.date}{inc.time&&` at ${inc.time}`}</div>
          </div>
          <div style={{display:"flex", gap:8}}>
            {inc.severity && <Badge label={`${sm.icon} ${inc.severity}`} color={sm.color} bg={sm.bg} />}
            <Badge label={inc.status} color={inc.status==="Submitted"?C.green:C.yellow} bg={inc.status==="Submitted"?"#0d2b14":"#332a00"} />
          </div>
        </div>
        <p style={{color:C.textDim, fontSize:14, marginTop:14, lineHeight:1.6}}>{inc.description}</p>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:14}}>
        <S title="Incident Details"><KV k="Type" v={inc.type}/><KV k="Area" v={inc.area}/><KV k="Location" v={inc.location}/><KV k="Department" v={inc.department}/></S>
        <S title="People Involved"><KV k="Person" v={inc.injuredPerson}/><KV k="Designation" v={inc.designation}/><KV k="Body Part" v={inc.bodyPart}/><KV k="First Aid" v={inc.firstAid}/><KV k="Witnesses" v={inc.witnesses}/><KV k="Supervisor" v={inc.supervisor}/></S>
      </div>

      {inc.events?.length>0 && (
        <S title={`Event Timeline · ${inc.events.length} events`}>
          {inc.events.map((ev,i)=>(
            <div key={ev.id} style={{display:"flex", gap:12, marginBottom:12, paddingBottom:12, borderBottom: i<inc.events.length-1?`1px solid ${C.border}`:"none"}}>
              <span style={{minWidth:60, fontSize:12, color:C.accent, fontWeight:700}}>{ev.time||`Step ${i+1}`}</span>
              <div><div style={{fontSize:12, color:C.muted, fontWeight:600}}>{ev.actor}</div><div style={{fontSize:13, color:C.text}}>{ev.description}</div></div>
            </div>
          ))}
        </S>
      )}

      {inc.whys?.some(w=>w) && (
        <S title="5-Why Analysis">
          {inc.whys.map((w,i)=>w?(
            <div key={i} style={{display:"flex", gap:12, marginBottom:10}}>
              <span style={{minWidth:24, fontSize:11, fontWeight:800, color:i===4?C.accent:C.muted}}>W{i+1}</span>
              <span style={{fontSize:13, color:C.text}}>{w}</span>
            </div>
          ):null)}
        </S>
      )}

      {(inc.taproot?.length>0||inc.rootCause) && (
        <S title="TapRoot & Root Cause">
          {inc.taproot?.length>0 && <div style={{display:"flex", flexWrap:"wrap", gap:6, marginBottom:12}}>{inc.taproot.map(t=><Badge key={t} label={t} color={C.accent} bg={C.accentDim}/>)}</div>}
          {inc.immediateCase && <KV k="Immediate Cause" v={inc.immediateCase}/>}
          {inc.contributingFactors && <KV k="Contributing Factors" v={inc.contributingFactors}/>}
          {inc.rootCause && <KV k="Root Cause" v={inc.rootCause}/>}
        </S>
      )}

      {inc.evidence?.length>0 && (
        <S title={`Evidence · ${inc.evidence.length} items`}>
          {inc.evidence.map(ev=>(
            <div key={ev.id} style={{display:"flex", gap:10, marginBottom:8, alignItems:"center", padding:10, background:C.bg, borderRadius:6}}>
              <Badge label={ev.type} color={C.blue} bg="#001d3d"/>
              <span style={{flex:1, fontSize:13, color:C.text}}>{ev.description}</span>
              {ev.ref && <span style={{fontSize:11, color:C.muted}}>#{ev.ref}</span>}
            </div>
          ))}
        </S>
      )}

      {inc.actions?.length>0 && (
        <S title={`CAPA Actions · ${inc.actions.length}`}>
          {inc.actions.map(a=>(
            <div key={a.id} style={{background:C.bg, border:`1px solid ${C.border}`, borderRadius:6, padding:12, marginBottom:8}}>
              <div style={{fontSize:13, color:C.text, marginBottom:6}}>{a.action}</div>
              <div style={{display:"flex", gap:10, flexWrap:"wrap", fontSize:12}}>
                <span style={{color:C.muted}}>👤 {a.responsible||"—"}</span>
                <span style={{color:C.muted}}>📅 {a.dueDate||"—"}</span>
                <Badge label={a.priority} color={a.priority==="Critical"?C.red:a.priority==="High"?C.accent:C.yellow} bg="transparent"/>
                <Badge label={a.status} color={a.status==="Closed"?C.green:a.status==="Overdue"?C.red:C.yellow} bg="transparent"/>
              </div>
            </div>
          ))}
        </S>
      )}
    </div>
  );
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
function Settings({ settings, onSave, appInfo }) {
  const [s, setS] = useState(settings);
  return (
    <div style={{maxWidth:540}}>
      <div style={{marginBottom:22}}>
        <div style={{fontSize:16, fontWeight:700, color:C.text}}>⚙️ Settings</div>
        <div style={{fontSize:12, color:C.muted, marginTop:4}}>Company information and application preferences</div>
      </div>
      <div style={{background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:22, marginBottom:16}}>
        <div style={{fontSize:11, fontWeight:700, color:C.muted, letterSpacing:1, textTransform:"uppercase", marginBottom:18}}>Company Information</div>
        {[["company","Company Name"],["department","Department"],["location","Location / Site"]].map(([k,l])=>(
          <Field key={k} label={l}>
            <Input value={s[k]||""} onChange={e=>setS(p=>({...p,[k]:e.target.value}))} />
          </Field>
        ))}
        <Btn onClick={()=>onSave(s)}>Save Settings</Btn>
      </div>
      {appInfo && (
        <div style={{background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:22}}>
          <div style={{fontSize:11, fontWeight:700, color:C.muted, letterSpacing:1, textTransform:"uppercase", marginBottom:14}}>Application Info</div>
          {[["Version",appInfo.version||"1.0.0"],["Platform",appInfo.platform||navigator.platform],["Data stored at",appInfo.dataDir||"Local Storage"]].map(([k,v])=>(
            <div key={k} style={{marginBottom:10}}>
              <div style={{fontSize:10, color:C.muted, fontWeight:700}}>{k}</div>
              <div style={{fontSize:12, color:C.textDim, fontFamily:"'IBM Plex Mono',monospace", wordBreak:"break-all"}}>{v}</div>
            </div>
          ))}
          {isElectron && <div style={{marginTop:14}}><Btn variant="ghost" small onClick={()=>window.hseAPI.openDataFolder()}>📂 Open Data Folder</Btn></div>}
        </div>
      )}
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [incidents, setIncidents] = useState([]);
  const [settings, setSettings] = useState({company:"My Company", department:"HSE", location:""});
  const [appInfo, setAppInfo] = useState(null);
  const [nav, setNav] = useState("dashboard");
  const [view, setView] = useState("dashboard"); // dashboard | list | new | edit | detail | settings
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);

  const showToast = (msg, type="success") => setToast({msg, type});

  useEffect(() => {
    Promise.all([Storage.getAll(), Storage.getSettings()])
      .then(([incs, sett]) => {
        setIncidents(incs);
        setSettings(sett);
        setLoading(false);
      });
    if (isElectron) window.hseAPI.getAppInfo().then(setAppInfo);
  }, []);

  const saveIncident = async (inc) => {
    await Storage.save(inc);
    setIncidents(prev => {
      const e = prev.find(i=>i.id===inc.id);
      return e ? prev.map(i=>i.id===inc.id?inc:i) : [inc,...prev];
    });
    showToast(`Report ${inc.reportNo} ${inc.status === "Submitted" ? "submitted" : "saved as draft"}`);
    setView("list"); setNav("list");
  };

  const deleteIncident = (id) => {
    setConfirm({
      msg: "Delete this incident report? This cannot be undone.",
      onConfirm: async () => {
        await Storage.delete(id);
        setIncidents(prev => prev.filter(i=>i.id!==id));
        showToast("Incident deleted", "success");
        setConfirm(null);
        setView("list");
      }
    });
  };

  const saveSettings = async (s) => {
    await Storage.saveSettings(s);
    setSettings(s);
    showToast("Settings saved");
  };

  const handleExport = async () => {
    const res = await Storage.export();
    if (res.success) showToast("Backup exported successfully");
    else showToast("Export cancelled", "error");
  };

  const goNav = (n) => { setNav(n); setView(n); setSelected(null); };

  const navItems = [
    {id:"dashboard", icon:"📊", label:"Dashboard"},
    {id:"list", icon:"📁", label:"Incidents"},
    {id:"new", icon:"➕", label:"New Report"},
    {id:"settings", icon:"⚙️", label:"Settings"},
  ];

  const renderMain = () => {
    if (loading) return <div style={{textAlign:"center", padding:80, color:C.muted}}>Loading...</div>;
    if (view==="new") return <IncidentForm onSave={saveIncident} onCancel={()=>goNav("list")} settings={settings} />;
    if (view==="edit"&&selected) return <IncidentForm initial={selected} onSave={saveIncident} onCancel={()=>setView("detail")} settings={settings} />;
    if (view==="detail"&&selected) return <IncidentDetail inc={selected} onBack={()=>setView("list")} onEdit={()=>setView("edit")} />;
    if (view==="settings") return <Settings settings={settings} onSave={saveSettings} appInfo={appInfo} />;
    if (nav==="list") return <IncidentList incidents={incidents} onNew={()=>setView("new")} onView={i=>{setSelected(i);setView("detail");}} onEdit={i=>{setSelected(i);setView("edit");}} onDelete={deleteIncident} />;
    return <Dashboard incidents={incidents} />;
  };

  return (
    <div style={{fontFamily:"'IBM Plex Sans','Segoe UI',sans-serif", background:C.bg, height:"100vh", display:"flex", flexDirection:"column", color:C.text, overflow:"hidden"}}>
      {/* Title bar */}
      <div style={{background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"0 20px", display:"flex", alignItems:"center", justifyContent:"space-between", height:52, flexShrink:0, WebkitAppRegion:"drag"}}>
        <div style={{display:"flex", alignItems:"center", gap:10}}>
          <div style={{width:30, height:30, borderRadius:7, background:C.accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, WebkitAppRegion:"no-drag"}}>⚠</div>
          <div>
            <div style={{fontSize:13, fontWeight:800, color:C.text, letterSpacing:0.5}}>HSE INCIDENT MANAGER</div>
            <div style={{fontSize:9, color:C.muted, letterSpacing:1}}>{settings.company} · {settings.location}</div>
          </div>
        </div>

        {/* Nav */}
        <div style={{display:"flex", gap:2, WebkitAppRegion:"no-drag"}}>
          {navItems.map(n => (
            <button key={n.id} onClick={()=>goNav(n.id)} style={{
              background: nav===n.id ? C.accentDim : "transparent",
              color: nav===n.id ? C.accent : C.muted,
              border:"none", borderRadius:6, padding:"5px 14px",
              fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit",
              display:"flex", alignItems:"center", gap:5,
            }}>
              <span>{n.icon}</span>{n.label}
            </button>
          ))}
        </div>

        <div style={{display:"flex", gap:8, alignItems:"center", WebkitAppRegion:"no-drag"}}>
          <div style={{fontSize:11, color:C.muted}}>{incidents.length} records</div>
          <Btn variant="ghost" small onClick={handleExport}>⬇ Backup</Btn>
        </div>
      </div>

      {/* Page header */}
      {(nav==="dashboard"||nav==="list") && view!=="detail" && view!=="new" && view!=="edit" && (
        <div style={{background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"14px 24px", flexShrink:0}}>
          <div style={{fontSize:15, fontWeight:700, color:C.text}}>
            {nav==="dashboard" ? "📊 Analytics Dashboard" : "📁 Incident Register"}
          </div>
          <div style={{fontSize:11, color:C.muted, marginTop:2}}>
            {nav==="dashboard"
              ? `${incidents.length} total incidents · Proactive safety analytics`
              : `${incidents.filter(i=>i.status==="Submitted").length} submitted · ${incidents.filter(i=>i.status==="Draft").length} drafts`}
          </div>
        </div>
      )}

      {/* Main scrollable area */}
      <div style={{flex:1, overflowY:"auto", padding:24}}>
        {renderMain()}
      </div>

      {/* Confirm dialog */}
      {confirm && (
        <div style={{position:"fixed", inset:0, background:"#000a", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000}}>
          <div style={{background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:28, maxWidth:400, width:"90%"}}>
            <div style={{fontSize:15, fontWeight:700, color:C.text, marginBottom:10}}>Confirm Delete</div>
            <p style={{color:C.textDim, fontSize:13, marginBottom:22}}>{confirm.msg}</p>
            <div style={{display:"flex", gap:10, justifyContent:"flex-end"}}>
              <Btn variant="ghost" onClick={()=>setConfirm(null)}>Cancel</Btn>
              <Btn variant="danger" onClick={confirm.onConfirm}>Delete</Btn>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)} />}
    </div>
  );
}
