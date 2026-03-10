interface SideButtonProps {
    onClick?: () => void;
    disabled?: boolean;
    variant?: 'primary' | 'secondary' | 'important';
    children: React.ReactNode;
}

export default function SideButton({ onClick, disabled, variant = 'primary', children }: SideButtonProps) {
    const base = "rounded-lg px-4 py-2 transition-colors cursor-pointer w-full text-center h-12 disabled:opacity-40 disabled:cursor-not-allowed";

    const styles = {
        primary: "bg-(--primary) text-white hover:bg-(--primary-hover)",
        secondary: "bg-(--input) text-white/70 hover:bg-(--input-hover) hover:text-white",
        important: "bg-[#1f1212] border border-[#3d1c1c] text-[#a05050] hover:bg-[#2a1515] hover:text-[#c06060] hover:border-[#5a2525]",
    }[variant];

    return (
        <button onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
            {children}
        </button>
    );
}
