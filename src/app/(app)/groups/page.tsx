'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Task, Group } from '@/types';
import TaskCard from '@/components/TaskCard';
import Modal from '@/components/Modal';
import { useUndo } from '@/components/UndoProvider';

interface GroupWithCount extends Group {
  tasks?: Array<{ count: number }>;
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupWithCount[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupWithCount | null>(null);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const { showUndo } = useUndo();

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
    <div className="px-4 md:px-8 pt-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-white tracking-tight">Groups</h1>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setNewGroupOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-xl transition-colors"
        >
          <span>+</span> New Group
        </motion.button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        {groups.map((group) => {
          const count = group.tasks?.[0]?.count ?? 0;
          const active = selectedGroup?.id === group.id;
          return (
            <motion.button
              key={group.id}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => active ? setSelectedGroup(null) : selectGroup(group)}
              className={`flex items-center justify-between px-4 py-4 rounded-2xl border text-left transition-colors ${
                active
                  ? 'bg-accent/12 border-accent/30 text-white'
                  : 'bg-card border-white/8 hover:border-white/14 text-white/80'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${active ? 'bg-accent/20' : 'bg-white/5'}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={`w-4 h-4 ${active ? 'text-accent' : 'text-white/40'}`}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-sm">{group.name}</p>
                  {group.is_default && (
                    <p className="text-xs text-white/30 mt-0.5">Default</p>
                  )}
                </div>
              </div>
              <span className={`text-sm font-semibold ${active ? 'text-accent' : 'text-white/30'}`}>
                {count}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Tasks for selected group */}
      <AnimatePresence>
        {selectedGroup && (
          <motion.div
            key={selectedGroup.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">
              {selectedGroup.name}
            </h2>
            {tasks.length === 0 ? (
              <p className="text-white/25 text-sm text-center py-8">No tasks in this group</p>
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

      {/* New Group Modal */}
      <Modal open={newGroupOpen} onClose={() => setNewGroupOpen(false)} title="New Group">
        <form onSubmit={createGroup} className="space-y-4">
          <input
            autoFocus
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Group name"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/25 text-sm outline-none focus:border-accent/50"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setNewGroupOpen(false)}
              className="flex-1 py-2 rounded-xl border border-white/10 text-white/60 text-sm hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newGroupName.trim() || creating}
              className="flex-1 py-2 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-medium transition-colors"
            >
              Create
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
