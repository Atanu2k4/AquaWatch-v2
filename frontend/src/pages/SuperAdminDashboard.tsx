import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";
import { RefreshCw, LogOut, Droplets, AlertTriangle, TrendingDown, TrendingUp, Star, MapPin } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Leaflet marker icons issue with Webpack/Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Custom icon creator based on status
const createStatusIcon = (status: WaterStatus) => {
  let color = "#94a3b8"; // default slate (unknown/no data)
  if (status === "critical") color = "#ef4444";
  if (status === "warning") color = "#f97316";
  if (status === "normal") color = "#eab308";
  if (status === "good") color = "#22c55e";

  return L.divIcon({
    className: "custom-div-icon",
    html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
};

type WaterStatus = "critical" | "warning" | "normal" | "good" | "unknown";

interface StateStats {
  waterLevel: number;
  status: WaterStatus;
  lastUpdated?: string;
  noData?: boolean;
}

const STATE_COORDS: Record<string, [number, number]> = {
  "Andhra Pradesh": [15.9129, 79.7400],
  "Arunachal Pradesh": [28.2180, 94.7278],
  "Assam": [26.2006, 92.9376],
  "Bihar": [25.0961, 85.3131],
  "Chhattisgarh": [21.2787, 81.8661],
  "Goa": [15.2993, 74.1240],
  "Gujarat": [22.2587, 71.1924],
  "Haryana": [29.0588, 76.0856],
  "Himachal Pradesh": [31.1048, 77.1665],
  "Jharkhand": [23.6102, 85.2799],
  "Karnataka": [15.3173, 75.7139],
  "Kerala": [10.8505, 76.2711],
  "Madhya Pradesh": [22.9734, 78.6569],
  "Maharashtra": [19.7515, 75.7139],
  "Manipur": [24.6637, 93.9063],
  "Meghalaya": [25.4670, 91.3662],
  "Mizoram": [23.1645, 92.9376],
  "Nagaland": [26.1584, 94.5624],
  "Odisha": [20.9517, 85.9000],
  "Punjab": [31.1471, 75.3412],
  "Rajasthan": [27.0238, 74.2179],
  "Sikkim": [27.5330, 88.5122],
  "Tamil Nadu": [11.1271, 78.6569],
  "Telangana": [18.1124, 79.0193],
  "Tripura": [23.9408, 91.9882],
  "Uttar Pradesh": [26.8467, 80.9462],
  "Uttarakhand": [30.0668, 79.0193],
  "West Bengal": [22.9868, 87.8550],
  "Delhi": [28.7041, 77.1025],
  "Jammu and Kashmir": [33.7782, 76.5762],
  "Ladakh": [34.1526, 77.5770],
};

function statusFromColor(color: string): WaterStatus {
  if (color === "critical") return "critical";
  if (color === "warning") return "warning";
  if (color === "normal") return "normal";
  if (color === "good") return "good";
  return "unknown";
}

function levelToStatus(level: number): WaterStatus {
  if (level < 20) return "critical";
  if (level < 40) return "warning";
  if (level < 70) return "normal";
  return "good";
}

// Helper component to center map on state click
function MapController({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 6, { animate: true });
    } else {
      map.flyTo([20.5937, 78.9629], 5, { animate: true });
    }
  }, [center, map]);
  return null;
}

export const SuperAdminDashboard: React.FC = () => {
  const { logout } = useAuth();
  const [stateData, setStateData] = useState<Record<string, StateStats>>({});
  const [loading, setLoading] = useState(true);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const snap = await getDocs(collection(db, "DWLR_state"));
      const data: Record<string, StateStats> = {};
      snap.forEach(d => {
        const raw = d.data();
        const stateName = d.id.replace(/_/g, " ");
        const level = typeof raw.waterLevel === "number" ? raw.waterLevel : 50;
        const status: WaterStatus = raw.statusColor
          ? statusFromColor(raw.statusColor)
          : levelToStatus(level);
        data[stateName] = {
          waterLevel: Math.round(level),
          status,
          lastUpdated: raw.lastUpdated?.toDate?.()?.toLocaleString() ?? undefined,
        };
      });
      // States with no Firestore doc yet — shown as "no data" rather than faked as normal
      Object.keys(STATE_COORDS).forEach(state => {
        if (!data[state]) {
          data[state] = { waterLevel: 0, status: "unknown", noData: true };
        }
      });
      setStateData(data);
      setLoadError(null);
    } catch (err) {
      console.error("Error loading DWLR_state:", err);
      setLoadError("Couldn't load national data. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const refresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const states = Object.entries(stateData);
  const criticalCount = states.filter(([, v]) => v.status === "critical").length;
  const warningCount  = states.filter(([, v]) => v.status === "warning").length;
  const normalCount   = states.filter(([, v]) => v.status === "normal").length;
  const goodCount     = states.filter(([, v]) => v.status === "good").length;
  const reportedStates = states.filter(([, v]) => !v.noData);
  const avgLevel = reportedStates.length > 0
    ? Math.round(reportedStates.reduce((s, [, v]) => s + v.waterLevel, 0) / reportedStates.length)
    : 0;

  // No-data states sort to the bottom — they aren't "critical", they're just unreported
  const sortedStates = [...states].sort((a, b) => {
    if (a[1].noData !== b[1].noData) return a[1].noData ? 1 : -1;
    return a[1].waterLevel - b[1].waterLevel;
  });

  const getStatusColor = (status: WaterStatus) => {
    if (status === "critical") return "text-red-600 bg-red-50";
    if (status === "warning") return "text-orange-600 bg-orange-50";
    if (status === "normal") return "text-yellow-600 bg-yellow-50";
    if (status === "good") return "text-green-600 bg-green-50";
    return "text-slate-500 bg-slate-100";
  };

  const mapCenter = selectedState && STATE_COORDS[selectedState] ? STATE_COORDS[selectedState] : null;

  return (
    <div className="flex min-h-screen flex-col bg-theme-base font-sans text-theme-text selection:bg-theme-accent selection:text-theme-text">
      {/* Header */}
      <header className="sticky top-0 z-20 h-16 border-b border-white/50 bg-white/70 backdrop-blur-xl shadow-sm">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
          <div className="flex flex-1 justify-start">
            <div className="flex items-center gap-3">
              <img src="/aquawatch.png" alt="AquaWatch Logo" className="h-8 w-auto object-contain" />
              <div>
                <h1 className="text-[15px] font-semibold text-slate-900 leading-tight">National Dashboard</h1>
                <p className="text-[12px] font-medium text-slate-500 leading-tight">Super Admin Portal</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-end gap-2 sm:gap-3">
            <button
              onClick={refresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-lg px-2 sm:px-3 py-1.5 text-[13px] font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-2 sm:px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-slate-700"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-6 py-8 flex-1">
        {loadError && (
          <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
              <p className="text-[13px] font-medium text-red-700">{loadError}</p>
            </div>
            <button
              onClick={refresh}
              className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}
        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center">
            <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-blue-600/30 border-t-blue-600" />
            <p className="text-[14px] text-slate-500">Loading national data…</p>
          </div>
        ) : (
          <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 transition-opacity ${refreshing ? "opacity-60 pointer-events-none" : ""}`}>
            {/* Left 2 cols: Map and Overview */}
            <div className="lg:col-span-2 flex flex-col space-y-6">
              {/* Stats Overview */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                {[
                  { label: "Critical", count: criticalCount, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50 border-red-100" },
                  { label: "Warning", count: warningCount, icon: TrendingDown, color: "text-orange-600", bg: "bg-orange-50 border-orange-100" },
                  { label: "Normal", count: normalCount, icon: Droplets, color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-100" },
                  { label: "Good", count: goodCount, icon: TrendingUp, color: "text-green-600", bg: "bg-green-50 border-green-100" },
                  { label: "Nat'l Avg", count: `${avgLevel}%`, icon: Star, color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
                ].map(s => (
                  <div key={s.label} className={`flex flex-col items-center justify-center rounded-2xl border p-4 text-center shadow-sm transition-all hover:-translate-y-1 hover:shadow-md ${s.bg}`}>
                    <s.icon className={`mb-2 h-5 w-5 ${s.color}`} />
                    <p className="text-[20px] font-bold text-slate-900 leading-tight">{s.count}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Map Container */}
              <div className="flex flex-col overflow-hidden rounded-2xl border border-white/60 bg-white/60 backdrop-blur-md shadow-lg" style={{ minHeight: '500px' }}>
                <div className="flex items-center justify-between border-b border-white/50 bg-white/40 px-5 py-3">
                  <h2 className="flex items-center space-x-2 text-[15px] font-semibold text-slate-900">
                    <MapPin className="h-4 w-4 text-blue-600" />
                    <span>India Water Level Map</span>
                  </h2>
                </div>
                <div className="relative z-0 flex-1">
                  <MapContainer
                    center={[20.5937, 78.9629]}
                    zoom={5}
                    style={{ height: "100%", width: "100%", zIndex: 1 }}
                    scrollWheelZoom={true}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapController center={mapCenter} />
                    {states.map(([stateName, info]) => {
                      const coords = STATE_COORDS[stateName];
                      if (!coords) return null;
                      return (
                        <Marker
                          key={stateName}
                          position={coords}
                          icon={createStatusIcon(info.status)}
                          eventHandlers={{
                            click: () => setSelectedState(stateName)
                          }}
                        >
                          <Popup>
                            <div className="p-1">
                              <h3 className="text-[14px] font-bold text-slate-900">{stateName}</h3>
                              <p className="text-[13px] capitalize text-slate-600">
                                {info.noData ? "No data yet" : `${info.status} — ${info.waterLevel}%`}
                              </p>
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                  </MapContainer>
                </div>
              </div>
            </div>

            {/* Right col: State List */}
            <div className="flex h-[calc(100vh-140px)] flex-col rounded-2xl border border-white/60 bg-white/60 backdrop-blur-md shadow-lg">
              <div className="border-b border-white/50 bg-white/40 px-5 py-4">
                <h2 className="text-[15px] font-semibold text-slate-900">Monitored States</h2>
                <p className="text-[12px] text-slate-500">Ranked by severity (lowest level first)</p>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="divide-y divide-slate-100">
                  {sortedStates.map(([name, info]) => (
                    <button
                      key={name}
                      onClick={() => setSelectedState(name)}
                      className={`flex w-full flex-col space-y-2 px-5 py-4 text-left transition-all hover:bg-white/80 ${selectedState === name ? "bg-white/90 shadow-sm" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[14px] font-semibold text-slate-900">{name}</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusColor(info.status)}`}>
                          {info.noData ? "No data" : info.status}
                        </span>
                      </div>
                      {info.noData ? (
                        <p className="text-[12px] text-slate-400">Awaiting first report</p>
                      ) : (
                        <div className="flex w-full items-center space-x-3">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full ${
                                info.status === "critical" ? "bg-red-500" :
                                info.status === "warning" ? "bg-orange-500" :
                                info.status === "normal" ? "bg-yellow-500" : "bg-green-500"
                              }`}
                              style={{ width: `${info.waterLevel}%` }}
                            />
                          </div>
                          <span className="w-8 text-right text-[12px] font-medium text-slate-500">{info.waterLevel}%</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
};
