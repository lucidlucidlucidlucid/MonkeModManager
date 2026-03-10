import { useState } from "react";
import "./App.css";
import ModPage from "./pages/ModPage";
import CreditsPage from "./pages/CreditsPage";

type Page = 'mods' | 'credits';

function App() {
  const [page, setPage] = useState<Page>('mods');

  return (
    <main className="overflow-hidden bg-(--bg) w-screen h-screen">
      <div data-tauri-drag-region className="w-full h-10 absolute top-0 left-0 z-50" />
      {page === 'mods'
        ? <ModPage onShowCredits={() => setPage('credits')} />
        : <CreditsPage onBack={() => setPage('mods')} />
      }
    </main>
  );
}

export default App;
