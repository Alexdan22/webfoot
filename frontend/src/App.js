import "@/App.css";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import Landing from "@/pages/Landing";

const WebfootStrandProof = process.env.NODE_ENV === "development"
  ? lazy(() => import("@/pages/dev/strand-proof/WebfootStrandProof"))
  : null;

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Landing />} />
            {WebfootStrandProof && (
              <Route path="/__labs/webfoot-strands" element={<WebfootStrandProof />} />
            )}
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster
        theme="dark"
        position="bottom-center"
        toastOptions={{
          style: {
            background: "#111827",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#E6EAF0",
            borderRadius: "12px",
          },
        }}
      />
    </div>
  );
}

export default App;
