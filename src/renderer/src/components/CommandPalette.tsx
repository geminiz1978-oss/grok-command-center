import { Command, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';

export interface CommandPaletteAction {
  id: string;
  label: string;
  group: string;
  description?: string;
  disabled?: boolean;
  run: () => void | Promise<void>;
}

interface CommandPaletteProps {
  actions: CommandPaletteAction[];
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ actions, isOpen, onClose }: CommandPaletteProps): JSX.Element | null {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const filteredActions = useMemo(() => filterActions(actions, query), [actions, query]);
  const selectedAction = filteredActions[selectedIndex];

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setQuery('');
    setSelectedIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) {
    return null;
  }

  async function runAction(action: CommandPaletteAction | undefined): Promise<void> {
    if (!action || action.disabled) {
      return;
    }

    onClose();
    await action.run();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((index) => Math.min(index + 1, Math.max(filteredActions.length - 1, 0)));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      void runAction(selectedAction);
    }
  }

  return (
    <div className="command-palette-overlay" role="presentation" onMouseDown={onClose}>
      <section className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={(event) => event.stopPropagation()}>
        <div className="command-palette-header">
          <Command size={17} />
          <input
            ref={inputRef}
            value={query}
            placeholder="Search commands"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="icon-button" title="Close command palette" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        <div className="command-palette-list">
          {filteredActions.length ? (
            filteredActions.map((action, index) => (
              <button
                className={`command-palette-row ${index === selectedIndex ? 'selected' : ''}`}
                disabled={action.disabled}
                key={action.id}
                onClick={() => void runAction(action)}
                type="button"
              >
                <Search size={14} />
                <span>
                  <strong>{action.label}</strong>
                  {action.description ? <small>{action.description}</small> : null}
                </span>
                <em>{action.group}</em>
              </button>
            ))
          ) : (
            <p className="empty-copy">No matching commands.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function filterActions(actions: CommandPaletteAction[], query: string): CommandPaletteAction[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return actions;
  }

  return actions.filter((action) =>
    [action.label, action.group, action.description ?? '']
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery)
  );
}
