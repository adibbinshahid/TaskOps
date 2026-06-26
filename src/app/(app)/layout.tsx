export const dynamic = 'force-dynamic';

import Nav from '@/components/Nav';
import UndoProvider from '@/components/UndoProvider';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <UndoProvider>
      <div className="md:pl-56">
        <Nav />
        <main className="pb-24 md:pb-6 min-h-dvh">{children}</main>
      </div>
    </UndoProvider>
  );
}
