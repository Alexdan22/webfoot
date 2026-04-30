import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import Landing from "@/pages/Landing";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
        </Routes>
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
