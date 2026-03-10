import { useState, useEffect } from "react";
import localCreditsData from "../../credits.json";
import SideButton from "../components/SideButton";

interface CreditsPageProps { onBack: () => void; }

const CREDITS_URL = "https://raw.githubusercontent.com/lucidlucidlucidlucid/MonkeModManager/main/credits.json";

export default function CreditsPage({ onBack }: CreditsPageProps) {
    const [creditsData, setCreditsData] = useState(localCreditsData);

    useEffect(() => {
        fetch(CREDITS_URL)
            .then(r => r.json())
            .then(setCreditsData)
            .catch(() => {});
    }, []);

    return (
        <main className="w-full h-screen p-4 overflow-hidden box-border">
            <div className="grid grid-cols-[2.5fr_1fr] grid-rows-[1fr_auto] w-full h-full gap-4">
                <div className="bg-(--card) rounded-lg h-full flex flex-col gap-4 p-4 items-center min-h-0 border border-(--border)">
                    <h1 className="text-3xl">CREDITS</h1>
                    <div id="mod-list" className="w-full flex-1 flex flex-col gap-2 overflow-auto">
                        {creditsData.credits.map((entry, i) => (
                            <div key={i} className="bg-(--input) rounded-lg w-full flex items-center p-3 border border-(--border) gap-3">
                                <div className="flex flex-col flex-1">
                                    <p className="text-lg leading-tight">{entry.name}</p>
                                    <p className="text-sm opacity-50">{entry.role}</p>
                                </div>
                                {'link' in entry && entry.link && (
                                    <a href={entry.link} target="_blank" rel="noopener noreferrer"
                                        className="text-sm text-(--primary) hover:underline shrink-0">
                                        GitHub
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-(--card) rounded-lg h-full flex flex-col gap-4 p-4 justify-center items-center border border-(--border)">
                    <SideButton onClick={onBack}>Back</SideButton>
                </div>

                <div className="col-span-2 h-12 flex items-center justify-center bg-(--card) rounded-lg border border-(--border)">
                    <p className="text-sm opacity-30">{creditsData.disclaimer}</p>
                </div>
            </div>
        </main>
    );
}
