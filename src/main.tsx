import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "./index.css";

import App from "./App";
import { AuthorizationProvider } from "./context/AuthorizationContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthorizationProvider>
        <App />
      </AuthorizationProvider>
    </BrowserRouter>
  </StrictMode>
);