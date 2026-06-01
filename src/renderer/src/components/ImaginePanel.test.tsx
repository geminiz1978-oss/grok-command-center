import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ImaginePanel } from './ImaginePanel';

describe('ImaginePanel', () => {
  it('keeps the prompt editable while a generation is running', () => {
    const html = renderToStaticMarkup(
      <ImaginePanel
        workspace={{ name: 'Test workspace', path: 'C:\\Test workspace' }}
        secretStatus={{ xai: true }}
        assets={[]}
        events={[]}
        isGenerating
        isStitching={false}
        onGenerate={vi.fn()}
        onStitch={vi.fn()}
        onRefresh={vi.fn()}
        onOpenAsset={vi.fn()}
        onDeleteAsset={vi.fn()}
      />
    );

    expect(html).toContain('<textarea');
    expect(html).not.toMatch(/<textarea[^>]+disabled/);
  });
});
