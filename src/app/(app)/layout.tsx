export const dynamic = 'force-dynamic';

import Nav from '@/components/Nav';
import UndoProvider from '@/components/UndoProvider';
import ThemeProvider from '@/components/ThemeProvider';
import NewTaskProvider from '@/components/NewTaskProvider';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <NewTaskProvider>
        <UndoProvider>
          <div className="md:pl-60">
            <Nav />
            <main className="pb-24 md:pb-6 min-h-dvh">{children}</main>
          </div>
        </UndoProvider>
      </NewTaskProvider>
    </ThemeProvider>
  );
}
