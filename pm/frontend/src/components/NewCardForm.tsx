import { useState, type FormEvent } from "react";

type NewCardFormProps = {
  onAdd: (title: string, details: string, priority?: string, dueDate?: string) => void;
};

type FormState = {
  title: string;
  details: string;
  priority: string;
  dueDate: string;
};

const INITIAL_STATE: FormState = { title: "", details: "", priority: "", dueDate: "" };

export const NewCardForm = ({ onAdd }: NewCardFormProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_STATE);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const close = () => {
    setIsOpen(false);
    setForm(INITIAL_STATE);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    onAdd(
      form.title.trim(),
      form.details.trim(),
      form.priority || undefined,
      form.dueDate || undefined,
    );
    close();
  };

  if (!isOpen) {
    return (
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full rounded-full border border-dashed border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--primary-blue)] transition hover:border-[var(--primary-blue)]"
        >
          Add a card
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          placeholder="Card title"
          className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
          required
        />
        <textarea
          value={form.details}
          onChange={(e) => update("details", e.target.value)}
          placeholder="Details"
          rows={2}
          className="w-full resize-none rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--gray-text)] outline-none transition focus:border-[var(--primary-blue)]"
        />
        <div className="flex gap-2">
          <select
            value={form.priority}
            onChange={(e) => update("priority", e.target.value)}
            className="flex-1 rounded-lg border border-[var(--stroke)] bg-white px-2 py-1.5 text-xs outline-none focus:border-[var(--primary-blue)]"
          >
            <option value="">No priority</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => update("dueDate", e.target.value)}
            className="flex-1 rounded-lg border border-[var(--stroke)] bg-white px-2 py-1.5 text-xs outline-none focus:border-[var(--primary-blue)]"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
          >
            Add card
          </button>
          <button
            type="button"
            onClick={close}
            className="rounded-full border border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};
