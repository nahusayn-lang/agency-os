import Header from "@/components/header";

export default function CrmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 lg:ml-[var(--sidebar-w)] transition-[margin-left] duration-300 ease-in-out">{children}</main>
    </div>
  );
}