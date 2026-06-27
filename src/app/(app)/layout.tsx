export const dynamic = 'force-dynamic';

import Nav from '@/components/Nav';
import UndoProvider from '@/components/UndoProvider';
import ThemeProvider from '@/components/ThemeProvider';
import NewTaskProvider from '@/components/NewTaskProvider';
import TopHeader from '@/components/TopHeader';
import StatusToast from '@/components/StatusToast';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <NewTaskProvider>
        <UndoProvider>
          <div className="md:pl-60">
            <Nav />
            <TopHeader />
            <main className="pt-14 pb-24 md:pb-6 min-h-dvh">{children}</main>
            <StatusToast />
          </div>
        </UndoProvider>
      </NewTaskProvider>
    </ThemeProvider>
  );
}
