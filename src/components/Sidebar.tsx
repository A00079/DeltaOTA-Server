"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  { href: "/admin/releases", label: "Releases", icon: "🚀" },
  { href: "/admin/upload", label: "Upload", icon: "📦" },
  { href: "/admin/analytics", label: "Analytics", icon: "📈" },
  { href: "/admin/history", label: "History", icon: "📋" },
  { href: "/admin/registry", label: "Registry", icon: "📱" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 min-h-screen p-4 flex flex-col">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-white">OTA Server</h1>
        <p className="text-xs text-gray-500 mt-1">Investor App Updates</p>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/50"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 border-t border-gray-800">
        <p className="text-xs text-gray-600">v1.0.0 • Next.js OTA</p>
      </div>
    </aside>
  );
}
