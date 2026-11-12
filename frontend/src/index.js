import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
// Fuentes empaquetadas localmente: la app funciona sin internet.
import "@fontsource/playfair-display/400.css";
import "@fontsource/playfair-display/400-italic.css";
import "@fontsource/playfair-display/600.css";
import "@fontsource/playfair-display/700.css";
import "@fontsource/playfair-display/800.css";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/400-italic.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/outfit/300.css";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import "@fontsource/outfit/700.css";
import "@/index.css";
import App from "@/App";
import { AuthProvider } from "@/context/AuthContext";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false } },
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <App />
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: "rgba(19, 26, 43, 0.95)",
            color: "#FEF3C7",
            border: "1px solid rgba(234, 179, 8, 0.4)",
            fontFamily: "'Outfit', system-ui, sans-serif",
          },
        }}
      />
    </AuthProvider>
  </QueryClientProvider>,
);
