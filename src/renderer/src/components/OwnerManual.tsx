import { BookOpenText, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import ownerManualMarkdown from '../../../../docs/OWNERS_MANUAL.md?raw';

interface OwnerManualProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ManualSection {
  id: string;
  title: string;
  lines: string[];
}

export function OwnerManual({ isOpen, onClose }: OwnerManualProps): JSX.Element | null {
  const [query, setQuery] = useState('');
  const sections = useMemo(() => parseManualSections(ownerManualMarkdown), []);
  const filteredSections = useMemo(() => filterSections(sections, query), [sections, query]);
  const activeSection = filteredSections[0] ?? sections[0];

  if (!isOpen) {
    return null;
  }

  return (
    <div className="owner-manual-overlay" role="presentation" onMouseDown={onClose}>
      <section className="owner-manual" role="dialog" aria-modal="true" aria-label="Owner's manual" onMouseDown={(event) => event.stopPropagation()}>
        <header className="owner-manual-header">
          <div>
            <span className="eyebrow">Help</span>
            <h2>Owner's Manual</h2>
          </div>
          <button className="icon-button" title="Close owner's manual" onClick={onClose}>
            <X size={15} />
          </button>
        </header>

        <div className="owner-manual-search">
          <Search size={15} />
          <input value={query} placeholder="Search the manual" onChange={(event) => setQuery(event.target.value)} />
        </div>

        <div className="owner-manual-body">
          <nav className="owner-manual-nav" aria-label="Owner's manual sections">
            {filteredSections.map((section) => (
              <a href={`#manual-${section.id}`} key={section.id}>
                <BookOpenText size={13} />
                <span>{section.title}</span>
              </a>
            ))}
          </nav>

          <article className="owner-manual-content">
            {filteredSections.length ? (
              filteredSections.map((section) => (
                <ManualSectionView section={section} key={section.id} />
              ))
            ) : (
              <section className="manual-section">
                <h3>{activeSection?.title ?? 'No matches'}</h3>
                <p>No manual sections matched that search.</p>
              </section>
            )}
          </article>
        </div>
      </section>
    </div>
  );
}

function ManualSectionView({ section }: { section: ManualSection }): JSX.Element {
  return (
    <section className="manual-section" id={`manual-${section.id}`}>
      <h3>{section.title}</h3>
      {section.lines.map((line, index) => renderManualLine(line, index))}
    </section>
  );
}

function renderManualLine(line: string, index: number): JSX.Element | null {
  const trimmed = line.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('### ')) {
    return <h4 key={index}>{trimmed.slice(4)}</h4>;
  }

  if (trimmed.startsWith('- ')) {
    return <p className="manual-bullet" key={index}>{trimmed.slice(2)}</p>;
  }

  return <p key={index}>{trimmed}</p>;
}

function parseManualSections(markdown: string): ManualSection[] {
  const lines = markdown.split(/\r?\n/);
  const sections: ManualSection[] = [];
  let current: ManualSection | null = null;

  for (const line of lines) {
    if (line.startsWith('# ')) {
      continue;
    }

    if (line.startsWith('## ')) {
      current = {
        id: slugify(line.slice(3)),
        title: line.slice(3).trim(),
        lines: []
      };
      sections.push(current);
      continue;
    }

    if (!current) {
      current = {
        id: 'overview',
        title: 'Overview',
        lines: []
      };
      sections.push(current);
    }

    current.lines.push(line);
  }

  return sections;
}

function filterSections(sections: ManualSection[], query: string): ManualSection[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return sections;
  }

  return sections.filter((section) => `${section.title}\n${section.lines.join('\n')}`.toLowerCase().includes(normalizedQuery));
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
