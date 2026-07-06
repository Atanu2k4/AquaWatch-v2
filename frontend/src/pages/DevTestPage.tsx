// DevTestPage.tsx — polished API test harness for AquaWatch backend
// Visit /dev-test directly (not linked from main nav).
// Covers every endpoint in backend/main.py.

import { useState } from "react";
import "./ApiTester.css";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const DEFAULT_API_KEY = "dev-local-key";

type ResponseState = {
  status: number | null;
  data: unknown;
  loading: boolean;
  error: string | null;
  time: number | null;
};

const initRes = (): ResponseState => ({
  status: null,
  data: null,
  loading: false,
  error: null,
  time: null,
});

async function callApi(
  method: "GET" | "POST",
  url: string,
  body?: unknown
): Promise<{ status: number; data: unknown; time: number }> {
  const start = performance.now();
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const time = Math.round(performance.now() - start);
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = await res.text();
  }
  return { status: res.status, data, time };
}

function ResultBox({ res }: { res: ResponseState }) {
  if (res.loading)
    return <div className="result-box loading">⏳ Loading…</div>;
  if (!res.status && !res.error) return null;
  const ok = res.status !== null && res.status < 300;
  return (
    <div className={`result-box ${ok ? "success" : "fail"}`}>
      <div className="result-meta">
        <span className={`badge ${ok ? "badge-ok" : "badge-fail"}`}>
          {res.status ?? "ERR"}
        </span>
        {res.time !== null && (
          <span className="result-time">{res.time} ms</span>
        )}
      </div>
      {res.error && <p className="result-error">{res.error}</p>}
      <pre className="result-json">{JSON.stringify(res.data, null, 2)}</pre>
    </div>
  );
}

function Card({
  title,
  tag,
  children,
}: {
  title: string;
  tag: "GET" | "POST";
  children: React.ReactNode;
}) {
  const tagColors: Record<string, string> = {
    GET: "#22c55e",
    POST: "#3b82f6",
  };
  return (
    <div className="card">
      <div className="card-header">
        <span
          className="method-tag"
          style={{ background: tagColors[tag] ?? "#6b7280" }}
        >
          {tag}
        </span>
        <h3 className="card-title">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export const DevTestPage: React.FC = () => {
  const [apiKey, setApiKey] = useState(DEFAULT_API_KEY);

  // ── GET /today-data ──
  const [todayRes, setTodayRes] = useState(initRes());

  // ── GET /state-data ──
  const [stateInput, setStateInput] = useState("West Bengal");
  const [stateRes, setStateRes] = useState(initRes());

  // ── GET /mongo-state ──
  const [mongoStateInput, setMongoStateInput] = useState("West Bengal");
  const [mongoRes, setMongoRes] = useState(initRes());

  // ── POST /sync ──
  const [syncRes, setSyncRes] = useState(initRes());

  // ── POST /admin/login ──
  const [adminId, setAdminId] = useState("WB@2026");
  const [adminPw, setAdminPw] = useState("1234");
  const [adminRes, setAdminRes] = useState(initRes());

  // ── POST /superadmin/login ──
  const [saId, setSaId] = useState("admin");
  const [saPw, setSaPw] = useState("Admin@123");
  const [saRes, setSaRes] = useState(initRes());

  // ── POST /l1-authority/register ──
  const [l1GovtId, setL1GovtId] = useState("GOVT001");
  const [l1Name, setL1Name] = useState("Officer Singh");
  const [l1Pw, setL1Pw] = useState("secret123");
  const [l1State, setL1State] = useState("WB");
  const [l1District, setL1District] = useState("Kolkata");
  const [l1RegRes, setL1RegRes] = useState(initRes());

  // ── POST /l1-authority/{govt_id}/approve ──
  const [approveGovtId, setApproveGovtId] = useState("GOVT001");
  const [approveAdminId, setApproveAdminId] = useState("WB@2026");
  const [approveAdminPw, setApproveAdminPw] = useState("1234");
  const [approveRes, setApproveRes] = useState(initRes());

  const run = async (
    setter: (r: ResponseState) => void,
    method: "GET" | "POST",
    url: string,
    body?: unknown
  ) => {
    setter({ ...initRes(), loading: true });
    try {
      const r = await callApi(method, url, body);
      setter({
        status: r.status,
        data: r.data,
        loading: false,
        error: null,
        time: r.time,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setter({ status: null, data: null, loading: false, error: msg, time: null });
    }
  };

  return (
    <div className="tester-root">
      {/* ── Header ── */}
      <header className="tester-header">
        <div className="header-brand">
          <span className="header-icon">💧</span>
          <div>
            <h1>AquaWatch API Tester</h1>
            <p>
              Backend at <code>{BASE_URL}</code> — visit{" "}
              <a
                href={`${BASE_URL}/docs`}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#58a6ff" }}
              >
                /docs
              </a>{" "}
              for Swagger UI
            </p>
          </div>
        </div>
        <div className="global-key">
          <label>Global API Key</label>
          <input
            id="global-api-key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="dev-local-key"
          />
        </div>
      </header>

      {/* ── Cards Grid ── */}
      <main className="tester-main">
        {/* 1. Today Data */}
        <Card title="/today-data" tag="GET">
          <p className="card-desc">
            Fetch all states' sensor readings for today's date from Firestore.
          </p>
          <button
            id="btn-today-data"
            onClick={() =>
              run(
                setTodayRes,
                "GET",
                `${BASE_URL}/today-data?api_key=${apiKey}`
              )
            }
          >
            Run Request
          </button>
          <ResultBox res={todayRes} />
        </Card>

        {/* 2. State Data */}
        <Card title="/state-data" tag="GET">
          <p className="card-desc">
            Fetch all Firestore records for a specific state.
          </p>
          <div className="field-row">
            <label htmlFor="state-input">State Name</label>
            <input
              id="state-input"
              value={stateInput}
              onChange={(e) => setStateInput(e.target.value)}
              placeholder="West Bengal"
            />
          </div>
          <button
            id="btn-state-data"
            onClick={() =>
              run(
                setStateRes,
                "GET",
                `${BASE_URL}/state-data?state=${encodeURIComponent(stateInput)}&api_key=${apiKey}`
              )
            }
          >
            Run Request
          </button>
          <ResultBox res={stateRes} />
        </Card>

        {/* 3. MongoDB State */}
        <Card title="/mongo-state" tag="GET">
          <p className="card-desc">
            Fetch the last 5 records for a state from MongoDB.
          </p>
          <div className="field-row">
            <label htmlFor="mongo-state-input">State Name</label>
            <input
              id="mongo-state-input"
              value={mongoStateInput}
              onChange={(e) => setMongoStateInput(e.target.value)}
              placeholder="West Bengal"
            />
          </div>
          <button
            id="btn-mongo-state"
            onClick={() =>
              run(
                setMongoRes,
                "GET",
                `${BASE_URL}/mongo-state?state=${encodeURIComponent(mongoStateInput)}&api_key=${apiKey}`
              )
            }
          >
            Run Request
          </button>
          <ResultBox res={mongoRes} />
        </Card>

        {/* 4. Manual Sync */}
        <Card title="/sync" tag="POST">
          <p className="card-desc">
            Manually trigger a CSV → Firebase + MongoDB sync.
          </p>
          <button
            id="btn-sync"
            className="btn-warn"
            onClick={() =>
              run(setSyncRes, "POST", `${BASE_URL}/sync?api_key=${apiKey}`)
            }
          >
            Trigger Sync
          </button>
          <ResultBox res={syncRes} />
        </Card>

        {/* 5. Admin Login */}
        <Card title="/admin/login" tag="POST">
          <p className="card-desc">Authenticate as a state admin.</p>
          <div className="field-row">
            <label htmlFor="admin-id">Admin ID</label>
            <input
              id="admin-id"
              value={adminId}
              onChange={(e) => setAdminId(e.target.value)}
              placeholder="WB@2026"
            />
          </div>
          <div className="field-row">
            <label htmlFor="admin-pw">Password</label>
            <input
              id="admin-pw"
              type="password"
              value={adminPw}
              onChange={(e) => setAdminPw(e.target.value)}
              placeholder="••••"
            />
          </div>
          <button
            id="btn-admin-login"
            onClick={() =>
              run(setAdminRes, "POST", `${BASE_URL}/admin/login`, {
                id: adminId,
                password: adminPw,
              })
            }
          >
            Login
          </button>
          <ResultBox res={adminRes} />
        </Card>

        {/* 6. Super Admin Login */}
        <Card title="/superadmin/login" tag="POST">
          <p className="card-desc">Authenticate as super admin.</p>
          <div className="field-row">
            <label htmlFor="sa-id">Super Admin ID</label>
            <input
              id="sa-id"
              value={saId}
              onChange={(e) => setSaId(e.target.value)}
              placeholder="admin"
            />
          </div>
          <div className="field-row">
            <label htmlFor="sa-pw">Password</label>
            <input
              id="sa-pw"
              type="password"
              value={saPw}
              onChange={(e) => setSaPw(e.target.value)}
              placeholder="••••"
            />
          </div>
          <button
            id="btn-sa-login"
            onClick={() =>
              run(setSaRes, "POST", `${BASE_URL}/superadmin/login`, {
                id: saId,
                password: saPw,
              })
            }
          >
            Login
          </button>
          <ResultBox res={saRes} />
        </Card>

        {/* 7. L1 Register */}
        <Card title="/l1-authority/register" tag="POST">
          <p className="card-desc">
            Register a new L1 Authority officer (status: pending admin
            approval).
          </p>
          <div className="field-grid">
            <div className="field-row">
              <label htmlFor="l1-govt-id">Govt ID</label>
              <input
                id="l1-govt-id"
                value={l1GovtId}
                onChange={(e) => setL1GovtId(e.target.value)}
              />
            </div>
            <div className="field-row">
              <label htmlFor="l1-name">Name</label>
              <input
                id="l1-name"
                value={l1Name}
                onChange={(e) => setL1Name(e.target.value)}
              />
            </div>
            <div className="field-row">
              <label htmlFor="l1-pw">Password</label>
              <input
                id="l1-pw"
                value={l1Pw}
                onChange={(e) => setL1Pw(e.target.value)}
              />
            </div>
            <div className="field-row">
              <label htmlFor="l1-state">State</label>
              <input
                id="l1-state"
                value={l1State}
                onChange={(e) => setL1State(e.target.value)}
              />
            </div>
            <div className="field-row">
              <label htmlFor="l1-district">District</label>
              <input
                id="l1-district"
                value={l1District}
                onChange={(e) => setL1District(e.target.value)}
              />
            </div>
          </div>
          <button
            id="btn-l1-register"
            onClick={() =>
              run(setL1RegRes, "POST", `${BASE_URL}/l1-authority/register`, {
                govt_id: l1GovtId,
                name: l1Name,
                password: l1Pw,
                state: l1State,
                district: l1District,
              })
            }
          >
            Register
          </button>
          <ResultBox res={l1RegRes} />
        </Card>

        {/* 8. L1 Approve */}
        <Card title="/l1-authority/{govt_id}/approve" tag="POST">
          <p className="card-desc">
            Approve a pending L1 Authority registration (admin only).
          </p>
          <div className="field-row">
            <label htmlFor="approve-govt-id">Govt ID</label>
            <input
              id="approve-govt-id"
              value={approveGovtId}
              onChange={(e) => setApproveGovtId(e.target.value)}
            />
          </div>
          <div className="field-row">
            <label htmlFor="approve-admin-id">Admin ID</label>
            <input
              id="approve-admin-id"
              value={approveAdminId}
              onChange={(e) => setApproveAdminId(e.target.value)}
            />
          </div>
          <div className="field-row">
            <label htmlFor="approve-admin-pw">Admin Password</label>
            <input
              id="approve-admin-pw"
              type="password"
              value={approveAdminPw}
              onChange={(e) => setApproveAdminPw(e.target.value)}
            />
          </div>
          <button
            id="btn-l1-approve"
            onClick={() =>
              run(
                setApproveRes,
                "POST",
                `${BASE_URL}/l1-authority/${approveGovtId}/approve?admin_id=${approveAdminId}&admin_password=${approveAdminPw}`
              )
            }
          >
            Approve
          </button>
          <ResultBox res={approveRes} />
        </Card>
      </main>
    </div>
  );
};
