import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "./index.css";

import App from "./App";
import { AuthorizationProvider } from "./context/AuthorizationContext";
import ErrorBoundary from "./components/shared/ErrorBoundary";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthorizationProvider>
          <App />
        </AuthorizationProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);