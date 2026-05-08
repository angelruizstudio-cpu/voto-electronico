import { AdminShell } from "@/components/AdminShell"

export default function PuertaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminShell role="oficina">{children}</AdminShell>
}
