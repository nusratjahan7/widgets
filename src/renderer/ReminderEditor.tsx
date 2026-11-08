import { useEffect, useRef, useState, type FormEvent } from 'react';
import { REPEAT_LABELS, dateKey, formatClock } from '../shared/reminders';
import type { Reminder, ReminderRepeat } from '../shared/types';
import { applyTheme } from './lib/theme';

const REPEATS = Object.keys(REPEAT_LABELS) as ReminderRepeat[];

function query(name: string): string {
  return new URLSearchParams(window.location.search).get(name) ?? '';
}

function nextHour(): string {
  const now = new Date();
  const hour = now.getHours() < 23 ? now.getHours() + 1 : 23;
  return `${String(hour).padStart(2, '0')}:00`;
}

function dateLabel(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function messageOf(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.replace(/^.*?Error:\s*/, '');
}

export function ReminderEditor() {
  const defaultColor = query('color') || '#34c759';
  const defaultLead = Number(query('lead')) || 0;
  const hour12 = query('hour12') === '1';

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => dateKey(new Date()));
  const [start, setStart] = useState(nextHour);
  const [end, setEnd] = useState('');
  const [color, setColor] = useState(defaultColor);
  const [repeat, setRepeat] = useState<ReminderRepeat>('none');
  const [lead, setLead] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    window.widgets
      .getAppearance()
      .then((appearance) => applyTheme(appearance.theme, appearance.resolvedTheme))
      .catch(() => {});

    window.widgets
      .getReminders()
      .then(setReminders)
      .catch((error: unknown) => setError(messageOf(error)));

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') window.close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setDate(dateKey(new Date()));
    setStart(nextHour());
    setEnd('');
    setColor(defaultColor);
    setRepeat('none');
    setLead('');
    setError(null);
  }

  function edit(reminder: Reminder) {
    setEditingId(reminder.id);
    setTitle(reminder.title);
    setDate(reminder.date);
    setStart(reminder.start);
    setEnd(reminder.end ?? '');
    setColor(reminder.color);
    setRepeat(reminder.repeat);
    setLead(reminder.leadMinutes !== undefined ? String(reminder.leadMinutes) : '');
    setError(null);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const next = await window.widgets.saveReminder({
        ...(editingId ? { id: editingId } : {}),
        title,
        date,
        start,
        ...(end ? { end } : {}),
        color,
        repeat,
        ...(lead.trim() !== '' ? { leadMinutes: Number(lead) } : {}),
      });
      setReminders(next);
      resetForm();
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      const next = await window.widgets.deleteReminder(id);
      setReminders(next);
      if (editingId === id) resetForm();
    } catch (error) {
      setError(messageOf(error));
    }
  }

  return (
    <div className="card reminder-editor">
      <header className="reminder-editor-head">
        <div>
          <span className="settings-label">Reminders</span>
          <p className="settings-help">
            {reminders.length === 0 ? 'No reminders yet.' : `${reminders.length} saved`}
          </p>
        </div>
        <button type="button" className="settings-btn" onClick={() => window.close()}>
          Close
        </button>
      </header>

      <div className="reminder-editor-body">
        {reminders.length > 0 && (
          <ul className="reminder-editor-list">
            {[...reminders]
              .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))
              .map((reminder) => (
                <li key={reminder.id} className="reminder-editor-row" data-active={editingId === reminder.id}>
                  <button type="button" className="reminder-editor-pick" onClick={() => edit(reminder)}>
                    <span className="reminder-editor-dot" style={{ background: reminder.color }} />
                    <span className="min-w-0 flex-1 text-left">
                      <span className="reminder-editor-title">{reminder.title}</span>
                      <span className="reminder-editor-meta">
                        {dateLabel(reminder.date)} · {formatClock(reminder.start, hour12)}
                        {reminder.end ? ` - ${formatClock(reminder.end, hour12)}` : ''}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="settings-btn settings-btn-danger"
                    aria-label={`Delete ${reminder.title}`}
                    onClick={() => void remove(reminder.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
          </ul>
        )}

        <form ref={formRef} className="reminder-form" onSubmit={(event) => void submit(event)}>
          <label className="reminder-form-field">
            <span>Title</span>
            <input
              className="settings-input"
              value={title}
              placeholder="Pay utility billing"
              autoFocus
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <div className="reminder-form-row">
            <label className="reminder-form-field">
              <span>Date</span>
              <input
                className="settings-input"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            <label className="reminder-form-field">
              <span>Start</span>
              <input
                className="settings-input"
                type="time"
                value={start}
                onChange={(event) => setStart(event.target.value)}
              />
            </label>
          </div>

          <div className="reminder-form-row">
            <label className="reminder-form-field">
              <span>End (optional)</span>
              <input
                className="settings-input"
                type="time"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
              />
            </label>
            <label className="reminder-form-field">
              <span>Color</span>
              <input
                className="reminder-color"
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
              />
            </label>
          </div>

          <div className="reminder-form-row">
            <label className="reminder-form-field">
              <span>Repeat</span>
              <select
                className="settings-select"
                value={repeat}
                onChange={(event) => setRepeat(event.target.value as ReminderRepeat)}
              >
                {REPEATS.map((value) => (
                  <option key={value} value={value}>
                    {REPEAT_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="reminder-form-field">
              <span>Remind me before</span>
              <input
                className="settings-input"
                type="number"
                min={0}
                max={1440}
                step={5}
                value={lead}
                placeholder={`Default (${defaultLead} min)`}
                onChange={(event) => setLead(event.target.value)}
              />
            </label>
          </div>

          {error && <p className="reminder-form-error">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <button type="submit" className="settings-btn settings-btn-primary" disabled={busy}>
              {editingId ? 'Save reminder' : 'Add reminder'}
            </button>
            {editingId && (
              <button type="button" className="settings-btn" onClick={resetForm}>
                New
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
