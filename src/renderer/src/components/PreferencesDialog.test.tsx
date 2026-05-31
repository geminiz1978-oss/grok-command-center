import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '@shared/qwenCatalog';
import { PreferencesDialog } from './PreferencesDialog';

describe('PreferencesDialog', () => {
  it('renders the important setup, preview, usage, and backup controls', () => {
    const html = renderToStaticMarkup(
      <PreferencesDialog
        isOpen
        settings={DEFAULT_SETTINGS}
        onClose={vi.fn()}
        onSaveSettings={vi.fn()}
        onExportSettings={vi.fn()}
        onImportSettings={vi.fn()}
        onExportSession={vi.fn()}
        onImportSession={vi.fn()}
        onOpenSetup={vi.fn()}
        onManagePromptTemplates={vi.fn()}
      />
    );

    expect(html).toContain('Grok Command Center settings');
    expect(html).toContain('Command override');
    expect(html).toContain('Usage limit');
    expect(html).toContain('Export session');
    expect(html).toContain('Import session');
  });

  it('renders nothing when closed', () => {
    const html = renderToStaticMarkup(
      <PreferencesDialog
        isOpen={false}
        settings={DEFAULT_SETTINGS}
        onClose={vi.fn()}
        onSaveSettings={vi.fn()}
        onExportSettings={vi.fn()}
        onImportSettings={vi.fn()}
        onExportSession={vi.fn()}
        onImportSession={vi.fn()}
        onOpenSetup={vi.fn()}
        onManagePromptTemplates={vi.fn()}
      />
    );

    expect(html).toBe('');
  });
});
