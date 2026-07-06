import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ExternalLink } from "lucide-react";

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  const scrollToFeatures = (e?: React.MouseEvent) => {
    e?.preventDefault();
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  };

  const features = [
    { title: "Real-Time Monitoring", desc: "Continuous 24/7 groundwater level tracking.", val: "24/7" },
    { title: "Advanced Analytics", desc: "AI-driven predictive trends.", val: "AI" },
    { title: "CGWA Compliant", desc: "Full compliance with reporting guidelines.", val: "100%" },
    { title: "Citizen Reporting", desc: "Empower citizens to instantly report crises.", val: "1.4B" },
  ];

  return (
    <div className="min-h-screen bg-theme-base text-theme-text selection:bg-theme-accent selection:text-theme-text w-full overflow-x-hidden">
      {/* ── MINIMAL NAVBAR ── */}
      <header className="fixed inset-x-0 top-0 z-50 px-6 py-6 flex justify-between items-center text-sm font-semibold uppercase tracking-widest bg-theme-base/80 backdrop-blur-md">
        <div className="flex-1 flex justify-start">
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center gap-2">
            <img src="/aquawatch.png" alt="AquaWatch Logo" className="h-8 w-auto object-contain" />
            <span className="font-bold text-lg tracking-tight">AquaWatch</span>
          </button>
        </div>
        
        <nav className="hidden md:flex gap-8">
          <a href="#features" onClick={scrollToFeatures} className="hover:opacity-70 transition-opacity">FEATURES</a>
          <button onClick={() => navigate("/report")} className="hover:opacity-70 transition-opacity">REPORT</button>
        </nav>
        
        <div className="flex-1 flex justify-end">
          <button onClick={() => navigate("/auth")} className="hover:opacity-70 transition-opacity">ADMIN</button>
        </div>
      </header>

      {/* ── HERO SECTION ── */}
      <main className="w-full">
        <section className="w-full min-h-screen flex flex-col items-center justify-center text-center relative px-6 overflow-hidden">
          
          <h1 className="font-serif text-6xl sm:text-7xl md:text-8xl lg:text-[8rem] leading-[0.9] tracking-tight relative z-10 flex flex-col items-center w-full max-w-full">
            <span>National</span>
            <span className="-mt-2 md:-mt-4">groundwater</span>
          </h1>

          <div className="mt-12 z-20 flex flex-col items-center justify-center w-full">
            <div className="w-full flex justify-center mb-8">
              <button 
                onClick={() => navigate("/report")}
                className="group relative inline-flex items-center justify-center bg-theme-accent text-theme-text px-12 py-3 rounded-full font-bold uppercase tracking-wider text-sm transition-transform hover:scale-105 shadow-sm hover:shadow-md"
              >
                <span>Report Incident</span>
                <span className="absolute right-2 bg-white rounded-full p-1 group-hover:translate-x-1 transition-transform flex items-center justify-center text-black">
                  <ArrowRight className="w-4 h-4" />
                </span>
              </button>
            </div>
            
            <p className="max-w-md mx-auto text-sm uppercase tracking-wider leading-relaxed px-4">
              Protecting India's future through advanced tech, lifestyle awareness, and AI monitoring. Built for a water-secure tomorrow.
            </p>
          </div>
        </section>

        {/* ── BLUE MIDDLE SECTION (Clean Cards) ── */}
        <section id="features" className="bg-theme-blue py-32 w-full">
          <div className="mx-auto w-full px-6 md:px-12 max-w-[1400px]">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 items-stretch">
              {features.map((f, i) => (
                <div key={i} className="bg-theme-accent text-theme-text p-8 rounded-2xl flex flex-col justify-between shadow-lg min-h-[360px]">
                  <div className="w-full h-32 bg-white/50 rounded-xl border border-white/60 mb-8 flex items-center justify-center overflow-hidden shadow-sm">
                    {/* Abstract placeholder graphic */}
                    <div className="w-16 h-16 border-2 border-theme-text rounded-full flex items-center justify-center opacity-60">
                      <div className="w-8 h-8 border-2 border-theme-text rounded-sm rotate-45"></div>
                    </div>
                  </div>
                  <div className="flex flex-col flex-1">
                    <h3 className="font-serif text-3xl leading-tight mb-4">{f.title}</h3>
                    <p className="text-xs uppercase font-bold tracking-wider opacity-70 leading-relaxed mb-8 flex-1">{f.desc}</p>
                    <div className="flex justify-between items-end border-t border-theme-text/20 pt-6">
                      <span className="text-xs uppercase font-semibold opacity-60">India</span>
                      <span className="font-sans text-2xl font-bold">{f.val}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── BOTTOM CTA ── */}
        <section className="py-32 px-6 text-center flex flex-col items-center">
          <p className="max-w-md mx-auto text-lg md:text-xl font-serif italic mb-12">
            Empowering citizens and authorities to monitor water resources seamlessly, report incidents quickly, and drive resolution.
          </p>
          
          <h2 className="font-serif text-[12vw] leading-none tracking-tight">
            protect water?
          </h2>
        </section>
      </main>

      {/* ── MINIMAL FOOTER ── */}
      <footer className="border-t-2 border-theme-text px-6 py-8 flex flex-col md:flex-row justify-between items-center gap-6 text-xs font-bold uppercase tracking-widest">
        <div className="flex flex-col items-center md:items-start gap-1">
          <span className="font-serif text-xl capitalize">AquaWatch</span>
          <span>© {new Date().getFullYear()}</span>
        </div>

        <div className="flex gap-8">
          <a href="#" className="hover:opacity-70">CGWB ↗</a>
          <a href="#" className="hover:opacity-70">Jal Shakti ↗</a>
          <a href="#" className="hover:opacity-70">Privacy ↗</a>
        </div>
      </footer>
    </div>
  );
};
