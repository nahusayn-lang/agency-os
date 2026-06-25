import Header from "@/components/header";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="lg:ml-64 p-6">{children}</main>
    </>
  );
}