import Header from "@/components/header";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="lg:ml-[var(--sidebar-w)] transition-[margin-left] duration-300 ease-in-out p-6">{children}</main>
    </>
  );
}