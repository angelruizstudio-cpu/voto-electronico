import { AdminShell } from "@/components/AdminShell"

export default function DocumentosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminShell role="oficina">{children}</AdminShell>
}
