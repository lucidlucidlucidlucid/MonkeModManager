export type ModStatus = 'idle' | 'installing' | 'installed' | 'error';

interface ModItemProps {
    name: string; author: string; link: string;
    selected: boolean; status: ModStatus; onToggle: () => void;
}

export default function ModItem({ name, author, link, selected, status, onToggle }: ModItemProps) {
    const isInstalled = status === 'installed';
    const isError = status === 'error';

    let cardClass = 'bg-(--input) border-(--border) hover:bg-(--input-hover)';
    if (selected) cardClass = 'bg-green-800 border-(--border)';
    else if (isError) cardClass = 'bg-red-950 border-(--border) hover:bg-red-900';

    return (
        <div onClick={onToggle} className={`rounded-lg w-full flex flex-col justify-center p-3 border transition-colors cursor-pointer select-none ${cardClass}`}>
            <div className="flex items-center gap-2">
                <p className="text-xl">{name}</p>
                <span className="text-sm opacity-50">{author}</span>
                {isInstalled && <span className="text-green-400 text-sm">installed</span>}
                <a href={link} target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="ml-auto text-sm text-(--primary) hover:underline">
                    GitHub
                </a>
            </div>
        </div>
    );
}
