import { useState, useEffect, useMemo } from "react";
import { open, confirm } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { dirname, join } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import SideButton from "../components/SideButton";
import ModItem, { ModStatus } from "../components/ModItem";

const MODS_URL = "https://raw.githubusercontent.com/lucidlucidlucidlucid/MonkeModManager/main/mods.json";
const VERSION_URL = "https://raw.githubusercontent.com/lucidlucidlucidlucid/MonkeModManager/main/version.txt";
const RELEASES_URL = "https://github.com/lucidlucidlucidlucid/MonkeModManager/releases";
const LOCAL_VERSION = "0.1.0";

type Loader = 'bepinex' | 'melonloader';

interface Mod {
    name: string;
    author: string;
    github: string;
    download: string;
    category: string;
}

interface ModsData {
    mods: Mod[];
    melonloader_mods: Mod[];
    categories: { name: string; rank: number }[];
}

interface ModPageProps {
    onShowCredits: () => void;
}

export default function ModPage({ onShowCredits }: ModPageProps) {
    const [gamePath, setGamePath] = useState<string | null>(() => localStorage.getItem('gamePath'));
    const [selectedMods, setSelectedMods] = useState<Set<string>>(() => {
        const currentLoader = (localStorage.getItem('loader') as Loader) ?? 'bepinex';
        const saved = localStorage.getItem(`selectedMods_${currentLoader}`);
        return saved ? new Set(JSON.parse(saved)) : new Set();
    });
    const [modStatuses, setModStatuses] = useState<Record<string, ModStatus>>({});
    const [isInstalling, setIsInstalling] = useState(false);
    const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
    const [modsData, setModsData] = useState<ModsData | null>(null);
    const [loader, setLoader] = useState<Loader>(() => (localStorage.getItem('loader') as Loader) ?? 'bepinex');
    const [view, setView] = useState<'mods' | 'settings'>('mods');

    useEffect(() => { if (!gamePath) selectGameExe(); }, []);

    useEffect(() => {
        localStorage.setItem(`selectedMods_${loader}`, JSON.stringify([...selectedMods]));
    }, [selectedMods, loader]);

    useEffect(() => {
        const controller = new AbortController();
        fetch(MODS_URL, { signal: controller.signal })
            .then(r => r.json())
            .then(setModsData)
            .catch(() => {});
        return () => controller.abort();
    }, []);

    useEffect(() => {
        fetch(VERSION_URL)
            .then(r => r.text())
            .then(remote => {
                if (remote.trim() !== LOCAL_VERSION) {
                    const go = window.confirm(`A new version (${remote.trim()}) is available! Open the releases page?`);
                    if (go) openUrl(RELEASES_URL);
                }
            })
            .catch(() => {});
    }, []);

    const selectGameExe = async () => {
        const selected = await open({ multiple: false, filters: [{ name: 'Executable', extensions: ['exe'] }] });
        if (selected && typeof selected === 'string') {
            if (selected.endsWith('Gorilla Tag.exe')) {
                localStorage.setItem('gamePath', selected);
                setGamePath(selected);
            } else {
                alert('Please select Gorilla Tag.exe');
            }
        }
    };

    const toggleMod = (modName: string) => {
        setSelectedMods(prev => {
            const next = new Set(prev);
            if (next.has(modName)) next.delete(modName);
            else next.add(modName);
            return next;
        });
    };

    const installMods = async () => {
        if (!gamePath) { alert('No game path set.'); return; }
        if (selectedMods.size === 0) { alert('Select at least one mod.'); return; }

        setIsInstalling(true);
        try {
            if (loader === 'bepinex') {
                const has = await invoke<boolean>('check_bepinex', { gamePath });
                if (!has) {
                    setProgress({ current: 0, total: selectedMods.size });
                    await invoke('install_bepinex', { gamePath });
                }
            } else {
                const has = await invoke<boolean>('check_melonloader', { gamePath });
                if (!has) {
                    setProgress({ current: 0, total: selectedMods.size });
                    await invoke('install_melonloader', { gamePath });
                }
            }

            const toInstall = activeMods.filter(m => selectedMods.has(m.name));
            setProgress({ current: 0, total: toInstall.length });

            for (let i = 0; i < toInstall.length; i++) {
                const mod = toInstall[i];
                setProgress({ current: i, total: toInstall.length });
                try {
                    await invoke('install_mod', { gamePath, downloadUrl: mod.download, modName: mod.name, loader });
                    setModStatuses(prev => ({ ...prev, [mod.name]: 'installed' }));
                } catch {
                    setModStatuses(prev => ({ ...prev, [mod.name]: 'error' }));
                }
                setProgress({ current: i + 1, total: toInstall.length });
            }
        } catch {
        } finally {
            setIsInstalling(false);
            setProgress(null);
        }
    };

    const switchLoader = async (newLoader: Loader) => {
        if (newLoader === loader) return;
        if (!gamePath) { alert('No game path set.'); return; }
        const name = newLoader === 'bepinex' ? 'BepInEx' : 'MelonLoader';
        const ok = await confirm(`Switch to ${name}? This will remove your current loader and all mods, then install ${name}.`, { title: 'Switch Loader', kind: 'warning' });
        if (!ok) return;

        localStorage.setItem(`selectedMods_${loader}`, JSON.stringify([...selectedMods]));

        setIsInstalling(true);
        try {
            if (loader === 'bepinex') {
                await invoke('uninstall_bepinex', { gamePath });
                await invoke('install_melonloader', { gamePath });
            } else {
                await invoke('uninstall_melonloader', { gamePath });
                await invoke('install_bepinex', { gamePath });
            }
            localStorage.setItem('loader', newLoader);
            setLoader(newLoader);
            setModStatuses({});

            const saved = localStorage.getItem(`selectedMods_${newLoader}`);
            setSelectedMods(saved ? new Set(JSON.parse(saved)) : new Set());
        } catch {
            alert('Something went wrong while switching loaders.');
        } finally {
            setIsInstalling(false);
        }
    };

    const uninstallAll = async () => {
        if (!gamePath) return;
        const ok = await confirm('This will remove your loader and all mods. The game will be back to normal.', { title: 'Uninstall All', kind: 'warning' });
        if (!ok) return;
        try {
            if (loader === 'bepinex') await invoke('uninstall_bepinex', { gamePath });
            else await invoke('uninstall_melonloader', { gamePath });
        } catch {}
        setModStatuses({});
    };

    const openModsFolder = async () => {
        if (!gamePath) return;
        const path = loader === 'melonloader'
            ? await join(await dirname(gamePath), 'Mods')
            : await join(await dirname(gamePath), 'BepInEx', 'plugins');
        await invoke('open_folder', { path });
    };

    const openGameFolder = async () => {
        if (!gamePath) return;
        await invoke('open_folder', { path: await dirname(gamePath) });
    };

    const activeMods = useMemo(() =>
        loader === 'melonloader' ? (modsData?.melonloader_mods ?? []) : (modsData?.mods ?? []),
        [modsData, loader]
    );

    const groupedMods = useMemo(() => activeMods.reduce((acc, mod) => {
        if (!acc[mod.category]) acc[mod.category] = [];
        acc[mod.category].push(mod);
        return acc;
    }, {} as Record<string, Mod[]>), [activeMods]);

    const sortedCategories = useMemo(() =>
        [...(modsData?.categories ?? [])].sort((a, b) => a.rank - b.rank),
        [modsData]
    );

    return (
        <main className="w-full h-screen p-4 overflow-hidden box-border">
            <div className="grid grid-cols-[2.5fr_1fr] grid-rows-[1fr_auto] w-full h-full gap-4">

                <div className="bg-(--card) rounded-lg h-full flex flex-col gap-4 p-4 items-center min-h-0 border border-(--border)">
                    {view === 'mods' ? (<>
                        <h1 className="text-3xl">MODS</h1>
                        <div id="mod-list" className="w-full flex-1 flex flex-col gap-4 overflow-auto">
                            {!modsData && <p className="text-sm opacity-50">Loading mods...</p>}
                            {sortedCategories.map(cat => groupedMods[cat.name] && (
                                <div key={cat.name} className="w-full flex flex-col gap-2">
                                    <h2 className="text-xl font-semibold">{cat.name}</h2>
                                    {groupedMods[cat.name].map(mod => (
                                        <ModItem key={mod.name}
                                            name={mod.name} author={mod.author} link={mod.github}
                                            selected={selectedMods.has(mod.name)}
                                            status={modStatuses[mod.name] ?? 'idle'}
                                            onToggle={() => toggleMod(mod.name)} />
                                    ))}
                                </div>
                            ))}
                        </div>
                    </>) : (<>
                        <h1 className="text-3xl">SETTINGS</h1>
                        <div className="w-full flex flex-col gap-3 pt-2">
                            <p className="text-xs opacity-40 uppercase tracking-wide">Mod Loader</p>
                            <div className="flex gap-2">
                                <button onClick={() => switchLoader('bepinex')} disabled={isInstalling} className={`flex-1 py-3 rounded-lg border text-sm font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${loader === 'bepinex' ? 'bg-(--primary) border-(--primary) text-white' : 'bg-(--input) border-(--border) text-white/40 hover:text-white/70'}`}>
                                    {isInstalling && loader !== 'bepinex' ? 'Switching...' : 'BepInEx'}
                                </button>
                                <button onClick={() => switchLoader('melonloader')} disabled={isInstalling} className={`flex-1 py-3 rounded-lg border text-sm font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${loader === 'melonloader' ? 'bg-(--primary) border-(--primary) text-white' : 'bg-(--input) border-(--border) text-white/40 hover:text-white/70'}`}>
                                    {isInstalling && loader !== 'melonloader' ? 'Switching...' : 'MelonLoader'}
                                </button>
                            </div>
                            <p className="text-xs opacity-30">Switching loaders will uninstall the current one and all mods.</p>
                        </div>
                    </>)}
                </div>

                <div className="bg-(--card) rounded-lg h-full flex flex-col p-4 items-center border border-(--border)">
                    <div className="flex-1 flex flex-col justify-center gap-4 w-full">
                        <SideButton onClick={installMods} disabled={isInstalling || view === 'settings'}>
                            {isInstalling ? 'Installing...' : 'Install / Update'}
                        </SideButton>
                        <SideButton variant="secondary" onClick={openModsFolder}>Mods Folder</SideButton>
                        <SideButton variant="secondary" onClick={openGameFolder}>Game Folder</SideButton>
                        <SideButton variant="secondary" onClick={() => setView(v => v === 'mods' ? 'settings' : 'mods')}>
                            {view === 'settings' ? '← Back' : 'Settings'}
                        </SideButton>
                        <button onClick={uninstallAll} className="w-full h-12 flex items-center justify-center text-xs text-[#a05050] hover:text-[#d06060] transition-colors cursor-pointer">
                            Uninstall ALL
                        </button>

                        {progress && (
                            <div className="w-full flex flex-col gap-1">
                                <div className="w-full h-2 bg-(--border) rounded-full overflow-hidden">
                                    <div className="h-full bg-green-600 transition-all duration-300"
                                        style={{ width: `${(progress.current / progress.total) * 100}%` }} />
                                </div>
                                <p className="text-xs opacity-50 text-center">{progress.current} / {progress.total}</p>
                            </div>
                        )}
                    </div>

                    <button onClick={onShowCredits} className="mb-2 text-xs opacity-30 hover:opacity-60 transition-opacity cursor-pointer">
                        Credits
                    </button>
                </div>

                <div id="current-directory" onClick={selectGameExe}
                    className="col-span-2 h-12 flex items-center justify-center bg-(--card) rounded-lg border border-(--border) cursor-pointer transition-colors hover:bg-(--input)">
                    <p className="text-sm opacity-50">{gamePath || 'No game directory selected'}</p>
                </div>

            </div>
        </main>
    );
}
