'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Task, Group } from '@/types';
import TaskCard from '@/components/TaskCard';
import Modal from '@/components/Modal';
import { useUndo } from '@/components/UndoProvider';
import { useNewTask } from '@/components/NewTaskProvider';

interface GroupWithCount extends Group {
  tasks?: Array<{ count: number }>;
}

const GROUP_COLORS = [
  'bg-blue-500/10 text-blue-500',
  'bg-violet-500/10 text-violet-500',
  'bg-emerald-500/10 text-emerald-500',
  'bg-amber-500/10 text-amber-500',
  'bg-rose-500/10 text-rose-500',
];

export default function TaskTypePage() {
  const [groups, setGroups] = useState<GroupWithCount[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupWithCount | null>(null);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const { showUndo } = useUndo();
  const { open: openNewTask } = useNewTask();

  async function loadGroups() {
    const res = await fetch('/api/groups');
    setGroups(await res.json());
  }

  async function loadTasksForGroup(groupId: string) {
    const res = await fetch(`/api/tasks?group_id=${groupId}`);
    setTasks(await res.json());
  }

  useEffect(() => { loadGroups(); }, []);

  async function selectGroup(group: GroupWithCount) {
    setSelectedGroup(group);
    await loadTasksForGroup(group.id);
  }

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newGroupName.trim() || creating) return;
    setCreating(true);
    await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newGroupName.trim() }),
    });
    setNewGroupName('');
    setNewGroupOpen(false);
    setCreating(false);
    loadGroups();
  }

  async function deleteTask(task: Task) {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
    showUndo({
      label: 'Task deleted',
      onUndo: async () => {
        await fetch(`/api/tasks/${task.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ field: 'status', value: task.status }),
        });
        if (selectedGroup) loadTasksForGroup(selectedGroup.id);
      },
    });
  }

  return (
    <div className="px-5 md:px-8 pt-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-t1 tracking-tight">Task Type</h1>
          <p className="text-sm text-t3 mt-0.5">Organise tasks into projects</p>
        </div>
        <div className="flex items-center gap-2">
          <motion.button whileTap={{ scale: 0.97 }} onClick={openNewTask}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-h text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
            New Task
          </motion.button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => setNewGroupOpen(true)}
            className="flex items-center gap-2 px-4 py-2 glass-sm hover:bg-accent/10 text-t1 text-sm font-medium rounded-xl transition-colors">
            New Type
          </motion.button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        {groups.map((group, i) => {
          const count = group.tasks?.[0]?.count ?? 0;
          const active = selectedGroup?.id === group.id;
          const color = GROUP_COLORS[i % GROUP_COLORS.length];
          const [bgClass, textClass] = color.split(' ');

          return (
            <motion.button
              key={group.id}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => active ? setSelectedGroup(null) : selectGroup(group)}
              className={`flex items-center justify-between px-4 py-4 rounded-2xl border text-left transition-all ${
                active
                  ? 'bg-accent/10 border-accent/25'
                  : 'glass-card hover:shadow-card-md'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${active ? 'bg-accent/20' : bgClass}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
                    className={`w-4 h-4 ${active ? 'text-accent' : textClass}`}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className={`font-semibold text-sm ${active ? 'text-accent' : 'text-t1'}`}>{group.name}</p>
                  {group.is_default && <p className="text-xs text-t3 mt-0.5">Default</p>}
                </div>
              </div>
              <span className={`text-sm font-bold ${active ? 'text-accent' : 'text-t3'}`}>{count}</span>
            </motion.button>
          );
        })}

        {groups.length === 0 && (
          <div className="col-span-2 text-center py-12 text-t3 text-sm">
            No task types yet — create one to get started
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedGroup && (
          <motion.div
            key={selectedGroup.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            <h2 className="text-xs font-semibold text-t3 uppercase tracking-widest mb-3">
              {selectedGroup.name}
            </h2>
            {tasks.length === 0 ? (
              <p className="text-t3 text-sm text-center py-8">No tasks in this type</p>
            ) : (
              <div className="space-y-2">
                {tasks.filter((t) => t.status !== 'deleted').map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    showGroup={false}
                    onDelete={() => deleteTask(task)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <Modal open={newGroupOpen} onClose={() => setNewGroupOpen(false)} title="New Task Type">
        <form onSubmit={createGroup} className="space-y-4">
          <input
            autoFocus
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Type name"
            className="w-full bg-s2 border border-t1/[0.08] rounded-xl px-4 py-2.5 text-t1 placeholder-t3 text-sm outline-none focus:border-accent/50 transition-colors"
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setNewGroupOpen(false)}
              className="flex-1 py-2 rounded-xl border border-t1/[0.08] text-t2 text-sm hover:bg-s2 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={!newGroupName.trim() || creating}
              className="flex-1 py-2 rounded-xl bg-accent hover:bg-accent-h disabled:opacity-40 text-white text-sm font-semibold transition-colors">
              Create
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
