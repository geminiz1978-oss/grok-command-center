import { Plus, RotateCcw, Save, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { PromptTemplateConfig } from '@shared/types';

interface PromptTemplateManagerProps {
  isOpen: boolean;
  templates: PromptTemplateConfig[];
  onClose: () => void;
  onSave: (templates: PromptTemplateConfig[]) => Promise<void>;
  onReset: () => Promise<void>;
}

export function PromptTemplateManager({
  isOpen,
  templates,
  onClose,
  onSave,
  onReset
}: PromptTemplateManagerProps): JSX.Element | null {
  const [draft, setDraft] = useState<PromptTemplateConfig[]>(templates);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDraft(templates);
    }
  }, [isOpen, templates]);

  if (!isOpen) {
    return null;
  }

  async function save(): Promise<void> {
    setIsSaving(true);

    try {
      await onSave(cleanTemplates(draft));
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  async function reset(): Promise<void> {
    if (!window.confirm('Reset prompt templates to the Grok Command Center defaults?')) {
      return;
    }

    setIsSaving(true);
    try {
      await onReset();
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  function updateTemplate(id: string, patch: Partial<PromptTemplateConfig>): void {
    setDraft((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function addTemplate(): void {
    setDraft((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        label: 'New task',
        prompt: 'Describe the reusable Grok task here.'
      }
    ]);
  }

  function deleteTemplate(id: string): void {
    setDraft((items) => items.filter((item) => item.id !== id));
  }

  return (
    <div className="prompt-manager-overlay" role="presentation" onMouseDown={onClose}>
      <section className="prompt-manager" role="dialog" aria-modal="true" aria-label="Prompt template manager" onMouseDown={(event) => event.stopPropagation()}>
        <header className="prompt-manager-header">
          <div>
            <span className="eyebrow">Prompts</span>
            <h2>Task templates</h2>
          </div>
          <button className="icon-button" title="Close prompt templates" onClick={onClose}>
            <X size={15} />
          </button>
        </header>

        <div className="prompt-manager-list">
          {draft.map((template) => (
            <article className="prompt-template-editor" key={template.id}>
              <div className="prompt-template-editor-title">
                <input
                  value={template.label}
                  maxLength={32}
                  onChange={(event) => updateTemplate(template.id, { label: event.target.value })}
                />
                <button className="icon-button danger" title="Delete template" onClick={() => deleteTemplate(template.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
              <textarea
                value={template.prompt}
                spellCheck={false}
                onChange={(event) => updateTemplate(template.id, { prompt: event.target.value })}
              />
            </article>
          ))}
        </div>

        <footer className="prompt-manager-actions">
          <button className="secondary-action" onClick={addTemplate} disabled={isSaving || draft.length >= 24}>
            <Plus size={15} />
            Add
          </button>
          <button className="secondary-action" onClick={() => void reset()} disabled={isSaving}>
            <RotateCcw size={15} />
            Reset
          </button>
          <button className="secondary-action" onClick={() => void save()} disabled={isSaving || !cleanTemplates(draft).length}>
            <Save size={15} />
            Save templates
          </button>
        </footer>
      </section>
    </div>
  );
}

function cleanTemplates(templates: PromptTemplateConfig[]): PromptTemplateConfig[] {
  return templates
    .map((template) => ({
      id: template.id || crypto.randomUUID(),
      label: template.label.trim(),
      prompt: template.prompt.trim()
    }))
    .filter((template) => template.label && template.prompt)
    .slice(0, 24);
}
